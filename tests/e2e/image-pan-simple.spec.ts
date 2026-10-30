import { test, expect } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';
import { makeTempDir, removeDir, writeTree } from '../helpers/fixtures';

let electronApp: ElectronAppHelper;
let testDir: string;

test.describe('Image Pan Functionality - Simple', () => {
  test.beforeEach(async () => {
    testDir = await makeTempDir('iv-pan-simple');
    await writeTree(testDir, { images: ['sample.png'] });

    electronApp = new ElectronAppHelper();
    await electronApp.launch({ downloadPath: testDir });
  });

  test.afterEach(async () => {
    await electronApp.close();
    await removeDir(testDir);
  });

  test('renders the pannable viewport once an image is shown', async () => {
    const page = electronApp.getWindow();

    await page.click('[data-menu-item="explore"]');
    await page.waitForSelector('.explore-panel', { state: 'visible', timeout: 10000 });

    // No viewport before an image is selected
    await expect(page.locator('.image-preview-viewport')).toHaveCount(0);

    await page.locator('.folder-node-item', { hasText: 'images' }).click();
    await page.locator('.file-list-item', { hasText: 'sample.png' }).click();

    const viewport = page.locator('.image-preview-viewport');
    await expect(viewport).toBeVisible();
    await expect(viewport.locator('.preview-image')).toBeVisible();
    await expect(page.locator('.zoom-level')).toHaveText('100%');
  });
});
