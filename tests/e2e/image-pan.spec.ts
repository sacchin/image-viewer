import { test, expect } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

let electronApp: ElectronAppHelper;
let testDir: string;

test.describe('Image Pan Functionality', () => {
  test.beforeEach(async () => {
    // Create test directory structure
    testDir = path.join(os.tmpdir(), `image-viewer-pan-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create test folder structure
    await fs.mkdir(path.join(testDir, 'test-images'), { recursive: true });

    // Create test image files (simple base64 PNG)
    const testImageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');

    // Add test images
    await fs.writeFile(path.join(testDir, 'test-images', 'image1.png'), testImageData);
    await fs.writeFile(path.join(testDir, 'test-images', 'image2.jpg'), testImageData);

    // Launch app
    electronApp = new ElectronAppHelper();
    await electronApp.launch();

    // Navigate to Explore panel
    const window = electronApp.getWindow();
    await window.click('[data-menu-item="explore"]');
    await window.waitForSelector('.explore-panel', { state: 'visible', timeout: 10000 });

    // Open the test directory
    await window.evaluate((dir) => {
      // Use IPC to open the test directory
      (window as any).electronAPI.openFolder(dir);
    }, testDir);
    await window.waitForTimeout(1000);
  });

  test.afterEach(async () => {
    await electronApp.close();
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (e) {
      // Ignore errors during cleanup
    }
  });

  test('should allow dragging image when zoomed in', async () => {
    const window = electronApp.getWindow();

    // Click on the test-images folder
    const folderItem = window.locator('.folder-node-item').filter({ hasText: 'test-images' });
    await expect(folderItem).toBeVisible({ timeout: 5000 });
    await folderItem.click();
    await window.waitForTimeout(500);

    // Select an image file
    const fileItem = window.locator('.file-item').filter({ hasText: 'image1.png' });
    await expect(fileItem).toBeVisible({ timeout: 5000 });
    await fileItem.click();
    await window.waitForTimeout(500);

    // Wait for image to load
    const imageElement = window.locator('.preview-image');
    await expect(imageElement).toBeVisible({ timeout: 5000 });

    // Zoom in to enable panning
    const zoomInButton = window.locator('.toolbar-button[title="Zoom In"]');
    await zoomInButton.click();
    await zoomInButton.click(); // Zoom in twice to ensure scale > 1

    // Get initial transform
    const initialTransform = await imageElement.evaluate(el => {
      return window.getComputedStyle(el).transform;
    });

    // Perform drag operation on the viewport
    const viewport = window.locator('.image-preview-viewport');
    const viewportBox = await viewport.boundingBox();

    if (viewportBox) {
      const centerX = viewportBox.x + viewportBox.width / 2;
      const centerY = viewportBox.y + viewportBox.height / 2;

      // Drag the image
      await window.mouse.move(centerX, centerY);
      await window.mouse.down();
      await window.mouse.move(centerX + 100, centerY + 50, { steps: 5 });
      await window.mouse.up();

      // Check if transform changed (image moved)
      const finalTransform = await imageElement.evaluate(el => {
        return window.getComputedStyle(el).transform;
      });

      expect(finalTransform).not.toBe(initialTransform);
    }
  });

  test('should reset position when fitting to window', async () => {
    const window = electronApp.getWindow();

    // Click on the test-images folder
    const folderItem = window.locator('.folder-node-item').filter({ hasText: 'test-images' });
    await expect(folderItem).toBeVisible({ timeout: 5000 });
    await folderItem.click();
    await window.waitForTimeout(500);

    // Select an image file
    const fileItem = window.locator('.file-item').filter({ hasText: 'image1.png' });
    await expect(fileItem).toBeVisible({ timeout: 5000 });
    await fileItem.click();
    await window.waitForTimeout(500);

    // Wait for image to load
    const imageElement = window.locator('.preview-image');
    await expect(imageElement).toBeVisible({ timeout: 5000 });

    // Zoom in and drag
    const zoomInButton = window.locator('.toolbar-button[title="Zoom In"]');
    await zoomInButton.click();
    await zoomInButton.click();

    const viewport = window.locator('.image-preview-viewport');
    const viewportBox = await viewport.boundingBox();

    if (viewportBox) {
      const centerX = viewportBox.x + viewportBox.width / 2;
      const centerY = viewportBox.y + viewportBox.height / 2;

      // Drag the image
      await window.mouse.move(centerX, centerY);
      await window.mouse.down();
      await window.mouse.move(centerX + 100, centerY + 50, { steps: 5 });
      await window.mouse.up();
    }

    // Click fit to window
    const fitButton = window.locator('.toolbar-button[title="Fit to Window"]');
    await fitButton.click();

    // Check if position is reset (translate should be 0,0)
    const transform = await imageElement.evaluate(el => {
      return window.getComputedStyle(el).transform;
    });

    // The transform should only contain scale, not translate (0,0 translate values)
    expect(transform).toMatch(/matrix\([^,]+, 0, 0, [^,]+, 0, 0\)/);
  });

  test('should show appropriate cursor when hovering over zoomable image', async () => {
    const window = electronApp.getWindow();

    // Click on the test-images folder
    const folderItem = window.locator('.folder-node-item').filter({ hasText: 'test-images' });
    await expect(folderItem).toBeVisible({ timeout: 5000 });
    await folderItem.click();
    await window.waitForTimeout(500);

    // Select an image file
    const fileItem = window.locator('.file-item').filter({ hasText: 'image1.png' });
    await expect(fileItem).toBeVisible({ timeout: 5000 });
    await fileItem.click();
    await window.waitForTimeout(500);

    // Wait for image to load
    const imageElement = window.locator('.preview-image');
    await expect(imageElement).toBeVisible({ timeout: 5000 });

    // Check cursor is default when not zoomed
    const viewport = window.locator('.image-preview-viewport');
    let cursor = await viewport.evaluate(el => {
      return window.getComputedStyle(el).cursor;
    });
    expect(cursor).toBe('default');

    // Zoom in
    const zoomInButton = window.locator('.toolbar-button[title="Zoom In"]');
    await zoomInButton.click();
    await zoomInButton.click();

    // Check cursor is grab when zoomed
    cursor = await viewport.evaluate(el => {
      return window.getComputedStyle(el).cursor;
    });
    expect(cursor).toBe('grab');
  });
});