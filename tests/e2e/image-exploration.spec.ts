import { test, expect, Page } from '@playwright/test';
import * as path from 'path';
import { ElectronAppHelper } from '../helpers/electron-app';
import { makeTempDir, removeDir, writeTree } from '../helpers/fixtures';

let electronApp: ElectronAppHelper;
let testDir: string;
let page: Page;

const folderItem = (name: string) =>
  page.locator('.folder-node-item').filter({ has: page.locator('.folder-name', { hasText: new RegExp(`^${name}$`) }) });
const fileItem = (name: string) => page.locator('.file-list-item', { hasText: name });
const previewImage = () => page.locator('[data-testid="image-preview"] img.preview-image');

test.describe('Image Exploration Feature', () => {
  test.beforeEach(async () => {
    testDir = await makeTempDir('iv-explore');
    await writeTree(testDir, {
      folder1: ['image1.png', 'image2.jpg', 'document.txt'],
      'folder1/subfolder1': ['image4.png'],
      folder2: ['image3.png', 'data.json']
    });

    // The app starts with testDir as its configured download root
    electronApp = new ElectronAppHelper();
    await electronApp.launch({ downloadPath: testDir });

    page = electronApp.getWindow();
    await page.click('[data-menu-item="explore"]');
    await page.waitForSelector('[data-panel="explore"]', { state: 'visible' });
    // Root node is rendered once the tree has been read from disk
    await expect(folderItem(path.basename(testDir))).toBeVisible();
  });

  test.afterEach(async () => {
    await electronApp.close();
    await removeDir(testDir);
  });

  test.describe('Folder Tree', () => {
    test('displays folder tree rooted at the configured download path', async () => {
      await expect(page.locator('[data-testid="folder-tree"]')).toBeVisible();
      await expect(page.locator('.folder-tree-header')).toHaveText('Folders');
      await expect(page.locator('.current-path')).toHaveText(testDir);

      // Root is auto-expanded, so its direct subfolders are listed
      await expect(page.locator('.folder-name')).toHaveText([path.basename(testDir), 'folder1', 'folder2']);
    });

    test('shows expand arrows on folder items', async () => {
      const arrow = folderItem('folder1').locator('.folder-arrow');
      await expect(arrow).toBeVisible();
      await expect(arrow).not.toHaveClass(/hidden/);
      await expect(arrow).not.toHaveClass(/expanded/);

      // Root was expanded automatically
      await expect(folderItem(path.basename(testDir)).locator('.folder-arrow')).toHaveClass(/expanded/);
    });

    test('expands and collapses a folder when its arrow is clicked', async () => {
      const arrow = folderItem('folder1').locator('.folder-arrow');
      await arrow.click();
      await expect(folderItem('subfolder1')).toBeVisible();
      await expect(arrow).toHaveClass(/expanded/);

      await arrow.click();
      await expect(folderItem('subfolder1')).toHaveCount(0);
    });

    test('highlights the selected folder', async () => {
      await folderItem('folder1').click();
      await expect(folderItem('folder1')).toHaveClass(/selected/);
      await expect(folderItem('folder2')).not.toHaveClass(/selected/);

      await folderItem('folder2').click();
      await expect(folderItem('folder2')).toHaveClass(/selected/);
      await expect(folderItem('folder1')).not.toHaveClass(/selected/);
    });

    test('shows only folder names without metadata', async () => {
      const text = (await folderItem('folder1').textContent()) ?? '';
      await expect(folderItem('folder1').locator('.folder-name')).toHaveText('folder1');
      expect(text).not.toContain('KB');
      expect(text).not.toContain('MB');
      expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}/);
    });
  });

  test.describe('File List', () => {
    test('shows empty state until a folder is selected', async () => {
      const fileList = page.locator('[data-testid="file-list"]');
      await expect(fileList).toBeVisible();
      await expect(fileList.locator('.file-list-empty')).toHaveText('Select a folder to view images');
      await expect(page.locator('.file-list-item')).toHaveCount(0);
    });

    test('displays image files of the selected folder', async () => {
      await folderItem('folder1').click();
      await expect(page.locator('.file-list-item .file-name')).toHaveText(['image1.png', 'image2.jpg']);
      await expect(page.locator('.file-count')).toHaveText('2 images');

      await folderItem('folder2').click();
      await expect(page.locator('.file-list-item .file-name')).toHaveText(['image3.png']);
    });

    test('hides non-image files', async () => {
      await folderItem('folder1').click();
      await expect(page.locator('.file-list-item')).toHaveCount(2);
      await expect(fileItem('document.txt')).toHaveCount(0);

      const names = await page.locator('.file-list-item .file-name').allTextContents();
      for (const name of names) {
        expect(name).toMatch(/\.(jpg|jpeg|png|gif|bmp|webp|svg)$/i);
      }
    });

    test('shows the file name for each entry', async () => {
      await folderItem('folder1').click();
      const first = page.locator('.file-list-item').first();
      await expect(first.locator('.file-name')).toHaveText('image1.png');
      await expect(first).toHaveAttribute('title', 'image1.png');
    });

    test('highlights the selected file', async () => {
      await folderItem('folder1').click();
      await fileItem('image1.png').click();
      await expect(fileItem('image1.png')).toHaveClass(/selected/);
      await expect(fileItem('image2.jpg')).not.toHaveClass(/selected/);
    });

    test('lists the files of a nested folder', async () => {
      await folderItem('folder1').locator('.folder-arrow').click();
      await folderItem('subfolder1').click();
      await expect(page.locator('.file-list-item .file-name')).toHaveText(['image4.png']);
    });
  });

  test.describe('Image Preview', () => {
    test('shows image preview when a file is selected', async () => {
      await expect(page.locator('.image-preview-empty')).toHaveText('Select an image to preview');

      await folderItem('folder1').click();
      await fileItem('image1.png').click();

      await expect(previewImage()).toBeVisible();
      await expect(previewImage()).toHaveAttribute('src', /^data:image\/png;base64,/);
    });

    test('renders the image with non-zero dimensions', async () => {
      await folderItem('folder1').click();
      await fileItem('image1.png').click();
      await expect(previewImage()).toBeVisible();

      const box = await previewImage().boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
      await expect(page.locator('.zoom-level')).toHaveText('100%');
    });

    test('updates preview when a different file is selected', async () => {
      await folderItem('folder1').click();
      await fileItem('image1.png').click();
      await expect(previewImage()).toHaveAttribute('src', /^data:image\/png/);

      await fileItem('image2.jpg').click();
      await expect(previewImage()).toHaveAttribute('src', /^data:image\/jpeg/);
    });

    test('clears preview when switching folders', async () => {
      await folderItem('folder1').click();
      await fileItem('image1.png').click();
      await expect(previewImage()).toBeVisible();

      await folderItem('folder2').click();
      await expect(previewImage()).toHaveCount(0);
      await expect(page.locator('.image-preview-empty')).toBeVisible();
    });
  });

  test.describe('Panel Layout', () => {
    test('has a two-pane sidebar with folder tree above file list', async () => {
      const sidebar = page.locator('.explore-panel-sidebar');
      await expect(sidebar).toBeVisible();
      await expect(sidebar.locator('.folder-tree')).toBeVisible();
      await expect(sidebar.locator('[data-testid="file-list"]')).toBeVisible();

      const treeBox = (await sidebar.locator('.folder-tree').boundingBox())!;
      const listBox = (await sidebar.locator('[data-testid="file-list"]').boundingBox())!;
      expect(treeBox.y).toBeLessThan(listBox.y);
    });

    test('keeps the sidebar narrower than the content area', async () => {
      const sidebarBox = (await page.locator('.explore-panel-sidebar').boundingBox())!;
      const contentBox = (await page.locator('.explore-panel-content').boundingBox())!;
      expect(sidebarBox.width).toBeLessThan(contentBox.width);
    });
  });

  test.describe('Settings Integration', () => {
    test('uses the download path from settings as the tree root', async () => {
      await page.click('[data-menu-item="setting"]');
      await page.waitForSelector('[data-panel="setting"]', { state: 'visible' });
      await expect(page.locator('[data-panel="setting"] .setting-input').first()).toHaveValue(testDir);

      await page.click('[data-menu-item="explore"]');
      await page.waitForSelector('[data-panel="explore"]', { state: 'visible' });
      await expect(page.locator('.folder-name').first()).toHaveText(path.basename(testDir));
    });
  });
});
