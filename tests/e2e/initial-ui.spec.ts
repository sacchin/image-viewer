import { test, expect } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';
import { MainPage } from '../pages/MainPage';

test.describe('UI Components Initial Display', () => {
  let electronApp: ElectronAppHelper;
  let mainPage: MainPage;

  test.beforeEach(async () => {
    electronApp = new ElectronAppHelper();
    await electronApp.launch();

    const window = electronApp.getWindow();
    mainPage = new MainPage(window);
    await mainPage.waitForLoad();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('✅ ツールバーが表示される', async () => {
    const isVisible = await mainPage.isToolbarVisible();
    expect(isVisible).toBe(true);

    const folderOpenBtn = await mainPage.toolbar.folderOpenButton().isVisible();
    expect(folderOpenBtn).toBe(true);

    const viewModeBtn = await mainPage.toolbar.viewModeButton().isVisible();
    expect(viewModeBtn).toBe(true);

    const sortBtn = await mainPage.toolbar.sortButton().isVisible();
    expect(sortBtn).toBe(true);

    const filterBtn = await mainPage.toolbar.filterButton().isVisible();
    expect(filterBtn).toBe(true);

    const searchInput = await mainPage.toolbar.searchInput().isVisible();
    expect(searchInput).toBe(true);
  });

  test('✅ サイドバー（フォルダツリー）が表示される', async () => {
    const isVisible = await mainPage.isSidebarVisible();
    expect(isVisible).toBe(true);

    const folderTree = await mainPage.sidebar.folderTree().isVisible();
    expect(folderTree).toBe(true);
  });

  test('✅ メインコンテンツエリア（画像グリッド）が表示される', async () => {
    const isVisible = await mainPage.isImageGridVisible();
    expect(isVisible).toBe(true);

    const container = await mainPage.imageGrid.container().isVisible();
    expect(container).toBe(true);
  });

  test('✅ ステータスバーが表示される', async () => {
    const isVisible = await mainPage.isStatusBarVisible();
    expect(isVisible).toBe(true);

    const statusText = await mainPage.getStatusText();
    expect(statusText.itemCount).toBeDefined();
    expect(statusText.zoomLevel).toBeDefined();
  });

  test('✅ 初期状態では画像が選択されていない', async () => {
    const selectedCount = await mainPage.getSelectedImageCount();
    expect(selectedCount).toBe(0);

    const statusText = await mainPage.getStatusText();
    expect(statusText.selectedCount).toContain('0');
  });

  test('空の状態メッセージが表示される（画像がない場合）', async () => {
    const imageCount = await mainPage.getImageCount();

    if (imageCount === 0) {
      const emptyState = await mainPage.imageGrid.emptyState().isVisible();
      expect(emptyState).toBe(true);
    }
  });

  test('各UIコンポーネントのレイアウトが正しい', async () => {
    const window = electronApp.getWindow();

    const layout = await window.evaluate(() => {
      const toolbar = document.querySelector('[data-testid="toolbar"]');
      const sidebar = document.querySelector('[data-testid="sidebar"]');
      const imageGrid = document.querySelector('[data-testid="image-grid"]');
      const statusBar = document.querySelector('[data-testid="status-bar"]');

      if (!toolbar || !sidebar || !imageGrid || !statusBar) {
        return null;
      }

      const toolbarRect = toolbar.getBoundingClientRect();
      const sidebarRect = sidebar.getBoundingClientRect();
      const imageGridRect = imageGrid.getBoundingClientRect();
      const statusBarRect = statusBar.getBoundingClientRect();

      return {
        toolbar: { top: toolbarRect.top, height: toolbarRect.height },
        sidebar: { left: sidebarRect.left, width: sidebarRect.width },
        imageGrid: { left: imageGridRect.left, width: imageGridRect.width },
        statusBar: { bottom: statusBarRect.bottom, height: statusBarRect.height }
      };
    });

    expect(layout).not.toBeNull();
    if (layout) {
      expect(layout.toolbar.top).toBe(0);
      expect(layout.sidebar.left).toBeGreaterThanOrEqual(0);
      expect(layout.imageGrid.left).toBeGreaterThan(layout.sidebar.width);
    }
  });

  test('検索入力フィールドがフォーカス可能', async () => {
    const searchInput = mainPage.toolbar.searchInput();
    await searchInput.focus();

    const isFocused = await searchInput.evaluate((el: HTMLElement) => {
      return document.activeElement === el;
    });

    expect(isFocused).toBe(true);
  });

  test('初期状態でフィルターとソートのデフォルト値が設定されている', async () => {
    const window = electronApp.getWindow();

    const defaultSettings = await window.evaluate(() => {
      const sortBtn = document.querySelector('[data-testid="sort-btn"]');
      const filterBtn = document.querySelector('[data-testid="filter-btn"]');

      return {
        sortText: sortBtn?.textContent || '',
        filterText: filterBtn?.textContent || ''
      };
    });

    expect(defaultSettings.sortText).toBeTruthy();
    expect(defaultSettings.filterText).toBeTruthy();
  });
});