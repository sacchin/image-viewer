import { test, expect, Locator, Page } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';
import { makeTempDir, removeDir, writeTree } from '../helpers/fixtures';

let electronApp: ElectronAppHelper;
let testDir: string;
let page: Page;

// Long enough to be wider than the 300px sidebar at any sane font size
const LONG_FOLDER =
  'very-long-folder-name-that-should-trigger-horizontal-scrollbar-in-the-folder-panel-of-the-explorer-sidebar';
const MANY_IMAGES = 'folder3-with-many-images';
// Alternating extensions so neighbouring files produce different data URLs
const manyImageNames = Array.from({ length: 10 }, (_, i) => {
  const n = String(i + 1).padStart(2, '0');
  return `image${n}.${i % 2 === 0 ? 'png' : 'jpg'}`;
});

const folderItem = (name: string): Locator =>
  page.locator('.folder-node-item').filter({ has: page.locator('.folder-name', { hasText: new RegExp(`^${name}$`) }) });
const arrowOf = (name: string): Locator => folderItem(name).locator('.folder-arrow');
const fileList = (): Locator => page.locator('[data-testid="file-list"]');
const selectedFile = (): Locator => page.locator('.file-list-item.selected');
const viewport = (): Locator => page.locator('.image-preview-viewport');
const previewImage = (): Locator => page.locator('[data-testid="image-preview"] img.preview-image');
const zoomLevel = (): Locator => page.locator('.zoom-level');

async function showFirstImageOf(folder: string): Promise<void> {
  await folderItem(folder).click();
  await page.locator('.file-list-item').first().click();
  await expect(previewImage()).toBeVisible();
  await expect(zoomLevel()).toHaveText('100%');
}

async function wheel(deltaY: number, ctrlKey: boolean): Promise<void> {
  await viewport().dispatchEvent('wheel', { deltaY, ctrlKey, bubbles: true, cancelable: true });
}

test.describe('UI Improvements - doc/1-8.md', () => {
  test.beforeEach(async () => {
    testDir = await makeTempDir('iv-ui');
    await writeTree(testDir, {
      [LONG_FOLDER]: ['image-with-extremely-long-filename-to-test-scrolling.png'],
      folder1: ['image1.png', 'image2.jpg'],
      'folder1/subfolder1': ['nested-image.png'],
      'folder1/subfolder1/level3': [],
      'folder1/subfolder1/level3/level4': [],
      'folder1/subfolder1/level3/level4/level5': [],
      'folder2/subfolder2': [],
      [MANY_IMAGES]: manyImageNames
    });

    electronApp = new ElectronAppHelper();
    await electronApp.launch({ downloadPath: testDir });

    page = electronApp.getWindow();
    await page.click('[data-menu-item="explore"]');
    await page.waitForSelector('.explore-panel', { state: 'visible', timeout: 10000 });
    await expect(folderItem('folder1')).toBeVisible();
  });

  test.afterEach(async () => {
    await electronApp.close();
    await removeDir(testDir);
  });

  test.describe('1. Horizontal Scrollbar in Folder Panel', () => {
    test('allows horizontal overflow in the folder tree', async () => {
      const content = page.locator('.folder-tree-content');
      await expect(content).toBeVisible();
      await expect(content).toHaveCSS('overflow-x', /auto|scroll/);
    });

    test('scrolls horizontally when a folder name is wider than the panel', async () => {
      const content = page.locator('.folder-tree-content');
      await expect(folderItem(LONG_FOLDER)).toBeVisible();

      const { scrollWidth, clientWidth } = await content.evaluate((el) => ({
        scrollWidth: el.scrollWidth,
        clientWidth: el.clientWidth
      }));
      expect(scrollWidth).toBeGreaterThan(clientWidth);

      await content.evaluate((el) => {
        el.scrollLeft = 50;
      });
      expect(await content.evaluate((el) => el.scrollLeft)).toBe(50);
    });

    test('keeps folder names on a single line instead of wrapping or truncating', async () => {
      await expect(folderItem(LONG_FOLDER)).toHaveCSS('white-space', 'nowrap');
      const nameBox = (await folderItem(LONG_FOLDER).locator('.folder-name').boundingBox())!;
      const panelBox = (await page.locator('.folder-tree-content').boundingBox())!;
      // The name is rendered at full width (reachable by scrolling), not clipped to the panel
      expect(nameBox.width).toBeGreaterThan(panelBox.width);
      const shortBox = (await folderItem('folder1').boundingBox())!;
      expect(nameBox.height).toBeLessThanOrEqual(shortBox.height);
    });
  });

  test.describe('2. Arrow Key Navigation in File List', () => {
    test.beforeEach(async () => {
      await folderItem(MANY_IMAGES).click();
      await expect(page.locator('.file-list-item')).toHaveCount(10);
      await fileList().focus();
    });

    test('navigates files with up/down arrow keys', async () => {
      await page.keyboard.press('ArrowDown');
      await expect(selectedFile().locator('.file-name')).toHaveText('image01.png');

      await page.keyboard.press('ArrowDown');
      await expect(selectedFile().locator('.file-name')).toHaveText('image02.jpg');

      await page.keyboard.press('ArrowUp');
      await expect(selectedFile().locator('.file-name')).toHaveText('image01.png');
    });

    test('opens the selected file with Enter', async () => {
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(previewImage()).toBeVisible();
      await expect(previewImage()).toHaveAttribute('src', /^data:image\/png/);
    });

    test('updates the image preview while navigating with arrow keys', async () => {
      await page.keyboard.press('ArrowDown');
      await expect(previewImage()).toHaveAttribute('src', /^data:image\/png/);

      await page.keyboard.press('ArrowDown');
      await expect(previewImage()).toHaveAttribute('src', /^data:image\/jpeg/);

      await page.keyboard.press('ArrowUp');
      await expect(previewImage()).toHaveAttribute('src', /^data:image\/png/);
    });

    test('stops at the first and last item', async () => {
      await page.keyboard.press('ArrowUp');
      await expect(selectedFile().locator('.file-name')).toHaveText('image01.png');

      for (let i = 0; i < 15; i++) {
        await page.keyboard.press('ArrowDown');
      }
      await expect(selectedFile().locator('.file-name')).toHaveText('image10.jpg');

      await page.keyboard.press('ArrowDown');
      await expect(selectedFile().locator('.file-name')).toHaveText('image10.jpg');
      await expect(selectedFile()).toHaveCount(1);
    });

    test('file list is focusable via tabindex', async () => {
      await expect(fileList()).toHaveAttribute('tabindex', '0');
      await expect(fileList()).toBeFocused();
    });
  });

  test.describe('3. Nested Folder Expansion Beyond Second Level', () => {
    test('shows expand arrows for folders at every level', async () => {
      for (const name of ['folder1', 'folder2', MANY_IMAGES]) {
        await expect(arrowOf(name)).toBeVisible();
        await expect(arrowOf(name)).not.toHaveClass(/hidden/);
      }

      // Once a folder is known to have no subfolders its arrow is hidden
      await arrowOf(MANY_IMAGES).click();
      await expect(arrowOf(MANY_IMAGES)).toHaveClass(/hidden/);
    });

    test('expands folders at the third level and beyond', async () => {
      await arrowOf('folder1').click();
      await expect(folderItem('subfolder1')).toBeVisible();

      await arrowOf('subfolder1').click();
      await expect(folderItem('level3')).toBeVisible();

      await arrowOf('level3').click();
      await expect(folderItem('level4')).toBeVisible();

      await arrowOf('level4').click();
      await expect(folderItem('level5')).toBeVisible();

      // Deeper levels are indented further (the row spans the panel; the label moves right)
      const level3Box = (await folderItem('level3').locator('.folder-name').boundingBox())!;
      const level5Box = (await folderItem('level5').locator('.folder-name').boundingBox())!;
      expect(level5Box.x).toBeGreaterThan(level3Box.x);
    });

    test('toggles folder expansion state', async () => {
      await arrowOf('folder1').click();
      await expect(folderItem('subfolder1')).toBeVisible();
      await expect(arrowOf('folder1')).toHaveClass(/expanded/);

      await arrowOf('folder1').click();
      await expect(folderItem('subfolder1')).toHaveCount(0);
      await expect(arrowOf('folder1')).not.toHaveClass(/expanded/);
    });

    test('maintains expansion state while navigating', async () => {
      await arrowOf('folder1').click();
      await expect(folderItem('subfolder1')).toBeVisible();
      await arrowOf('subfolder1').click();
      await expect(folderItem('level3')).toBeVisible();

      await folderItem('folder2').click();
      await expect(folderItem('folder2')).toHaveClass(/selected/);
      await expect(folderItem('subfolder2')).toBeVisible();

      await folderItem('folder1').click();
      await expect(folderItem('folder1')).toHaveClass(/selected/);
      await expect(folderItem('level3')).toBeVisible();
    });
  });

  test.describe('4. Mouse Wheel Zoom', () => {
    test.beforeEach(async () => {
      await showFirstImageOf('folder1');
    });

    test('zooms in with Ctrl + mouse wheel up', async () => {
      await wheel(-100, true);
      await expect(zoomLevel()).toHaveText('120%');
      await expect(previewImage()).toHaveCSS('transform', 'matrix(1.2, 0, 0, 1.2, 0, 0)');
    });

    test('zooms out with Ctrl + mouse wheel down', async () => {
      await wheel(-100, true);
      await expect(zoomLevel()).toHaveText('120%');

      await wheel(100, true);
      await expect(zoomLevel()).toHaveText('96%');
    });

    test('zooms with the mouse wheel even without Ctrl', async () => {
      await wheel(-100, false);
      await expect(zoomLevel()).toHaveText('120%');

      await wheel(100, false);
      await expect(zoomLevel()).toHaveText('96%');
    });

    test('respects zoom limits (min 10%, max 500%)', async () => {
      for (let i = 0; i < 20; i++) {
        await wheel(-100, true);
      }
      await expect(zoomLevel()).toHaveText('500%');
      await wheel(-100, true);
      await expect(zoomLevel()).toHaveText('500%');

      for (let i = 0; i < 20; i++) {
        await wheel(100, true);
      }
      await expect(zoomLevel()).toHaveText('10%');
      await wheel(100, true);
      await expect(zoomLevel()).toHaveText('10%');
    });

    test('does not scroll vertically with the mouse wheel on the preview', async () => {
      const container = page.locator('[data-testid="image-preview"]');
      const before = await container.evaluate((el) => el.scrollTop);

      await wheel(100, false);
      await wheel(-100, false);

      expect(await container.evaluate((el) => el.scrollTop)).toBe(before);
      expect(await viewport().evaluate((el) => el.scrollTop)).toBe(0);
    });

    test('zoom buttons change the scale as well', async () => {
      await page.locator('.toolbar-button[title="Zoom In"]').click();
      await expect(zoomLevel()).toHaveText('120%');

      await page.locator('.toolbar-button[title="Zoom Out"]').click();
      await expect(zoomLevel()).toHaveText('96%');

      await page.locator('.toolbar-button[title="Actual Size"]').click();
      await expect(zoomLevel()).toHaveText('100%');
    });
  });

  test.describe('Integration Tests', () => {
    test('all features work together', async () => {
      // Deep folder navigation
      await arrowOf('folder1').click();
      await expect(folderItem('subfolder1')).toBeVisible();
      await arrowOf('subfolder1').click();
      await expect(folderItem('level3')).toBeVisible();

      // Long names overflow horizontally instead of wrapping
      await folderItem(LONG_FOLDER).click();
      await expect(page.locator('.file-list-item .file-name')).toHaveText([
        'image-with-extremely-long-filename-to-test-scrolling.png'
      ]);

      // Keyboard navigation in a folder with many images
      await folderItem(MANY_IMAGES).click();
      await expect(page.locator('.file-list-item')).toHaveCount(10);
      await fileList().focus();
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
      await expect(selectedFile().locator('.file-name')).toHaveText('image02.jpg');
      await expect(previewImage()).toHaveAttribute('src', /^data:image\/jpeg/);

      // Wheel zoom then fit back to window
      await wheel(-100, true);
      await expect(zoomLevel()).toHaveText('120%');
      await page.locator('.toolbar-button[title="Fit to Window"]').click();
      await expect(zoomLevel()).toHaveText('100%');

      // Expansion state survived all of the above
      await expect(folderItem('level3')).toBeVisible();
    });
  });
});
