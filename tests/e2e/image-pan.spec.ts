import { test, expect, Page } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';
import { makeTempDir, removeDir, writeTree } from '../helpers/fixtures';

let electronApp: ElectronAppHelper;
let testDir: string;
let page: Page;

test.describe('Image Pan Functionality', () => {
  test.beforeEach(async () => {
    testDir = await makeTempDir('iv-pan');
    await writeTree(testDir, { 'test-images': ['image1.png', 'image2.jpg'] });

    electronApp = new ElectronAppHelper();
    await electronApp.launch({ downloadPath: testDir });

    page = electronApp.getWindow();
    await page.click('[data-menu-item="explore"]');
    await page.waitForSelector('.explore-panel', { state: 'visible', timeout: 10000 });

    // Open the folder and show an image
    await page.locator('.folder-node-item', { hasText: 'test-images' }).click();
    await page.locator('.file-list-item', { hasText: 'image1.png' }).click();
    await expect(page.locator('.preview-image')).toBeVisible();
    await expect(page.locator('.zoom-level')).toHaveText('100%');
  });

  test.afterEach(async () => {
    await electronApp.close();
    await removeDir(testDir);
  });

  // .preview-image animates transform (0.2s), so always assert with the retrying matcher
  const previewImage = () => page.locator('.preview-image');

  async function dragViewport(dx: number, dy: number): Promise<void> {
    const box = (await page.locator('.image-preview-viewport').boundingBox())!;
    const centerX = box.x + box.width / 2;
    const centerY = box.y + box.height / 2;
    await page.mouse.move(centerX, centerY);
    await page.mouse.down();
    await page.mouse.move(centerX + dx, centerY + dy, { steps: 5 });
    await page.mouse.up();
  }

  test('allows dragging the image when zoomed in', async () => {
    const zoomIn = page.locator('.toolbar-button[title="Zoom In"]');
    await zoomIn.click();
    await zoomIn.click();
    await expect(page.locator('.zoom-level')).toHaveText('144%');
    await expect(previewImage()).toHaveCSS('transform', 'matrix(1.44, 0, 0, 1.44, 0, 0)');

    await dragViewport(100, 50);

    await expect(previewImage()).toHaveCSS('transform', 'matrix(1.44, 0, 0, 1.44, 100, 50)');
  });

  test('does not move the image when not zoomed in', async () => {
    await expect(previewImage()).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
    await dragViewport(100, 50);
    await page.waitForTimeout(300); // longer than the transform transition
    await expect(previewImage()).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, 0)');
  });

  test('resets position when fitting to window', async () => {
    const zoomIn = page.locator('.toolbar-button[title="Zoom In"]');
    await zoomIn.click();
    await zoomIn.click();
    await dragViewport(100, 50);
    await expect(previewImage()).toHaveCSS('transform', /, 100, 50\)$/);

    await page.locator('.toolbar-button[title="Fit to Window"]').click();

    // Only scale remains, translate is back to 0,0
    await expect(previewImage()).toHaveCSS('transform', /^matrix\([^,]+, 0, 0, [^,]+, 0, 0\)$/);
    await expect(page.locator('.zoom-level')).toHaveText('100%');
  });

  test('shows a grab cursor only while the image is zoomable', async () => {
    const viewport = page.locator('.image-preview-viewport');
    await expect(viewport).toHaveCSS('cursor', 'default');

    const zoomIn = page.locator('.toolbar-button[title="Zoom In"]');
    await zoomIn.click();
    await zoomIn.click();
    await expect(viewport).toHaveCSS('cursor', 'grab');

    await page.locator('.toolbar-button[title="Actual Size"]').click();
    await expect(viewport).toHaveCSS('cursor', 'default');
  });
});
