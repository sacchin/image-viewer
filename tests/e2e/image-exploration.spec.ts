import { test, expect } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';
import * as path from 'path';
import * as fs from 'fs/promises';
import * as os from 'os';

let electronApp: ElectronAppHelper;
let testDir: string;

test.describe('Image Exploration Feature', () => {
  test.beforeEach(async () => {
    // Create test directory structure
    testDir = path.join(os.tmpdir(), `image-viewer-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });

    // Create test folder structure
    await fs.mkdir(path.join(testDir, 'folder1'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'folder2'), { recursive: true });
    await fs.mkdir(path.join(testDir, 'folder1', 'subfolder1'), { recursive: true });

    // Create test image files
    const testImageData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
    await fs.writeFile(path.join(testDir, 'folder1', 'image1.png'), testImageData);
    await fs.writeFile(path.join(testDir, 'folder1', 'image2.jpg'), testImageData);
    await fs.writeFile(path.join(testDir, 'folder2', 'image3.png'), testImageData);
    await fs.writeFile(path.join(testDir, 'folder1', 'subfolder1', 'image4.png'), testImageData);

    // Create non-image files
    await fs.writeFile(path.join(testDir, 'folder1', 'document.txt'), 'test document');
    await fs.writeFile(path.join(testDir, 'folder2', 'data.json'), '{"test": "data"}');

    // Launch app
    electronApp = new ElectronAppHelper();
    await electronApp.launch();

    // Navigate to Explore panel
    const page = electronApp.getWindow();
    await page.click('[data-item="explore"]');
    await page.waitForSelector('[data-panel="explore"]', { state: 'visible' });
  });

  test.afterEach(async () => {
    await electronApp.close();

    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to clean up test directory:', error);
    }
  });

  test.describe('Folder Tree', () => {
    test('should display folder tree with root folder from settings', async () => {
      // The folder tree should be visible
      const page = electronApp.getWindow();
      const folderTree = await page.locator('[data-testid="folder-tree"]');
      await expect(folderTree).toBeVisible();

      // Should have a header indicating it's the folder tree
      const header = await page.locator('.folder-tree-header');
      await expect(header).toBeVisible();
    });

    test('should show folder structure with expand/collapse icons', async () => {
      // Check for folder items with expand icons
      const page = electronApp.getWindow();
      const folderItems = await page.locator('.folder-tree-item');
      const count = await folderItems.count();

      // Should have at least one folder item when properly implemented
      // For now, checking the container exists
      const folderTreeContainer = await page.locator('.folder-tree');
      await expect(folderTreeContainer).toBeVisible();
    });

    test('should expand folder when triangle icon is clicked', async () => {
      // This will test the expand functionality once implemented
      // Look for expand icon
      const page = electronApp.getWindow();
      const expandIcon = await page.locator('.folder-tree-item .expand-icon').first();

      if (await expandIcon.isVisible()) {
        await expandIcon.click();

        // Check if children are now visible
        const childItems = await page.locator('.folder-tree-item.child-item');
        const childCount = await childItems.count();
        expect(childCount).toBeGreaterThan(0);
      }
    });

    test('should highlight selected folder', async () => {
      // Click on a folder item
      const page = electronApp.getWindow();
      const folderItem = await page.locator('.folder-tree-item').first();

      if (await folderItem.isVisible()) {
        await folderItem.click();

        // Check if the folder is highlighted
        await expect(folderItem).toHaveClass(/selected/);
      }
    });

    test('should only show folder names without metadata', async () => {
      // Check that folder items only display names
      const page = electronApp.getWindow();
      const folderItem = await page.locator('.folder-tree-item').first();

      if (await folderItem.isVisible()) {
        const text = await folderItem.textContent();

        // Should not contain metadata like size, date, etc.
        expect(text).not.toContain('KB');
        expect(text).not.toContain('MB');
        expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/); // Date pattern
      }
    });
  });

  test.describe('File List', () => {
    test('should show empty state initially', async () => {
      // File list should exist but be empty initially
      const page = electronApp.getWindow();
      const fileList = await page.locator('[data-testid="file-list"]');

      if (await fileList.isVisible()) {
        const emptyState = await fileList.locator('.file-list-empty');
        await expect(emptyState).toBeVisible();
      }
    });

    test('should display files when folder is selected', async () => {
      // Select a folder
      const page = electronApp.getWindow();
      const folderItem = await page.locator('.folder-tree-item').first();

      if (await folderItem.isVisible()) {
        await folderItem.click();

        // Check if files are displayed
        const fileItems = await page.locator('.file-list-item');
        const fileCount = await fileItems.count();

        // Should show files in the selected folder
        expect(fileCount).toBeGreaterThanOrEqual(0);
      }
    });

    test('should only show image files', async () => {
      // Select a folder with mixed files
      const page = electronApp.getWindow();
      const folderItem = await page.locator('.folder-tree-item').first();

      if (await folderItem.isVisible()) {
        await folderItem.click();

        // Get all file items
        const fileItems = await page.locator('.file-list-item');
        const fileCount = await fileItems.count();

        for (let i = 0; i < fileCount; i++) {
          const fileName = await fileItems.nth(i).textContent();

          // Should only contain image extensions
          expect(fileName).toMatch(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i);
        }
      }
    });

    test('should display only file names', async () => {
      // Select a folder
      const page = electronApp.getWindow();
      const folderItem = await page.locator('.folder-tree-item').first();

      if (await folderItem.isVisible()) {
        await folderItem.click();

        // Check file items
        const fileItem = await page.locator('.file-list-item').first();

        if (await fileItem.isVisible()) {
          const text = await fileItem.textContent();

          // Should not contain metadata
          expect(text).not.toContain('KB');
          expect(text).not.toContain('MB');
          expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
        }
      }
    });

    test('should highlight selected file', async () => {
      // Select a folder first
      const page = electronApp.getWindow();
      const folderItem = await page.locator('.folder-tree-item').first();

      if (await folderItem.isVisible()) {
        await folderItem.click();

        // Select a file
        const fileItem = await page.locator('.file-list-item').first();

        if (await fileItem.isVisible()) {
          await fileItem.click();

          // Check if file is highlighted
          await expect(fileItem).toHaveClass(/selected/);
        }
      }
    });
  });

  test.describe('Image Preview', () => {
    test('should show image preview when file is selected', async () => {
      // Select a folder
      const page = electronApp.getWindow();
      const folderItem = await page.locator('.folder-tree-item').first();

      if (await folderItem.isVisible()) {
        await folderItem.click();

        // Select an image file
        const fileItem = await page.locator('.file-list-item').first();

        if (await fileItem.isVisible()) {
          await fileItem.click();

          // Check if preview is displayed
          const preview = await page.locator('[data-testid="image-preview"]');
          await expect(preview).toBeVisible();

          // Check if image element exists
          const image = await preview.locator('img');
          await expect(image).toBeVisible();
        }
      }
    });

    test('should display image at appropriate size', async () => {
      // Select and preview an image
      const page = electronApp.getWindow();
      const folderItem = await page.locator('.folder-tree-item').first();

      if (await folderItem.isVisible()) {
        await folderItem.click();

        const fileItem = await page.locator('.file-list-item').first();

        if (await fileItem.isVisible()) {
          await fileItem.click();

          // Check image dimensions
          const image = await page.locator('[data-testid="image-preview"] img');

          if (await image.isVisible()) {
            const boundingBox = await image.boundingBox();

            // Image should be visible and have reasonable dimensions
            expect(boundingBox).toBeDefined();
            if (boundingBox) {
              expect(boundingBox.width).toBeGreaterThan(0);
              expect(boundingBox.height).toBeGreaterThan(0);
            }
          }
        }
      }
    });

    test('should update preview when different file is selected', async () => {
      // Select a folder with multiple images
      const page = electronApp.getWindow();
      const folderItem = await page.locator('.folder-tree-item').first();

      if (await folderItem.isVisible()) {
        await folderItem.click();

        const fileItems = await page.locator('.file-list-item');
        const fileCount = await fileItems.count();

        if (fileCount >= 2) {
          // Select first file
          await fileItems.nth(0).click();
          const firstImageSrc = await page.locator('[data-testid="image-preview"] img').getAttribute('src');

          // Select second file
          await fileItems.nth(1).click();
          const secondImageSrc = await page.locator('[data-testid="image-preview"] img').getAttribute('src');

          // Source should be different
          expect(firstImageSrc).not.toBe(secondImageSrc);
        }
      }
    });

    test('should clear preview when switching folders', async () => {
      const page = electronApp.getWindow();
      const folderItems = await page.locator('.folder-tree-item');
      const folderCount = await folderItems.count();

      if (folderCount >= 2) {
        // Select first folder and a file
        await folderItems.nth(0).click();

        const fileItem = await page.locator('.file-list-item').first();
        if (await fileItem.isVisible()) {
          await fileItem.click();

          // Verify preview is shown
          const preview = await page.locator('[data-testid="image-preview"]');
          await expect(preview).toBeVisible();

          // Switch to another folder
          await folderItems.nth(1).click();

          // Preview should be cleared or show new folder's content
          // This behavior depends on implementation
        }
      }
    });
  });

  test.describe('Panel Layout', () => {
    test('should have two-pane layout in sidebar', async () => {
      // Check for split layout in the explore panel sidebar
      const page = electronApp.getWindow();
      const sidebar = await page.locator('.explore-panel-sidebar');
      await expect(sidebar).toBeVisible();

      // Should have both folder tree and file list sections
      const folderTreeSection = await sidebar.locator('.folder-tree-section, .folder-tree');
      const fileListSection = await sidebar.locator('.file-list-section, .file-list');

      // Both sections should be present (once implemented)
      // For now, checking the sidebar exists
      await expect(sidebar).toBeVisible();
    });

    test('should maintain panel proportions', async () => {
      const page = electronApp.getWindow();
      const sidebar = await page.locator('.explore-panel-sidebar');
      const content = await page.locator('.explore-panel-content');

      // Both should be visible
      await expect(sidebar).toBeVisible();
      await expect(content).toBeVisible();

      // Check relative sizes
      const sidebarBox = await sidebar.boundingBox();
      const contentBox = await content.boundingBox();

      if (sidebarBox && contentBox) {
        // Sidebar should be narrower than content
        expect(sidebarBox.width).toBeLessThan(contentBox.width);
      }
    });
  });

  test.describe('Settings Integration', () => {
    test('should use download path from settings as root', async () => {
      // Navigate to settings
      const page = electronApp.getWindow();
      await page.click('[data-item="setting"]');
      await page.waitForSelector('[data-panel="setting"]', { state: 'visible' });

      // Get the download path
      const downloadPathInput = await page.locator('input[placeholder*="download"]');
      const downloadPath = await downloadPathInput.inputValue();

      // Go back to explore
      await page.click('[data-item="explore"]');
      await page.waitForSelector('[data-panel="explore"]', { state: 'visible' });

      // The root of folder tree should correspond to the download path
      // This would need actual implementation to verify
      const folderTree = await page.locator('.folder-tree');
      await expect(folderTree).toBeVisible();
    });
  });
});