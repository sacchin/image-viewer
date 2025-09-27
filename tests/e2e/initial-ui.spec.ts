import { test, expect } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';

test.describe('UI Components Initial Display', () => {
  let electronApp: ElectronAppHelper;

  test.beforeEach(async () => {
    electronApp = new ElectronAppHelper();
    await electronApp.launch();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('✅ サイドメニューが表示される', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // サイドメニューが表示されているか確認
    const sideMenu = await page.locator('.side-menu').isVisible();
    expect(sideMenu).toBe(true);

    // 4つのメニュー項目が存在するか確認
    const menuItems = await page.locator('[data-menu-item]').count();
    expect(menuItems).toBe(4);
  });

  test('✅ 初期状態でExploreパネルが表示される', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // デフォルトでExploreパネルがアクティブか確認
    const activeItem = await page.locator('[data-menu-item="explore"].active').isVisible();
    expect(activeItem).toBe(true);

    // Exploreパネルが表示されているか確認
    const explorePanel = await page.locator('[data-panel="explore"]').isVisible();
    expect(explorePanel).toBe(true);
  });

  test('✅ ステータスバーが表示される', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // ステータスバーが表示されているか確認
    const statusBar = await page.locator('[data-testid="status-bar"]').isVisible();
    expect(statusBar).toBe(true);

    // 現在のパネル名が表示されているか確認
    const currentPanel = await page.locator('.current-panel').textContent();
    expect(currentPanel).toContain('Explore');
  });

  test('✅ レイアウト構造が正しい', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // メインレイアウトコンテナが存在するか
    const layoutMain = await page.locator('.layout-main').isVisible();
    expect(layoutMain).toBe(true);

    // サイドバーとコンテンツエリアが存在するか
    const layoutSidebar = await page.locator('.layout-sidebar').isVisible();
    expect(layoutSidebar).toBe(true);

    const layoutContent = await page.locator('.layout-content').isVisible();
    expect(layoutContent).toBe(true);

    // フッターが存在するか
    const layoutFooter = await page.locator('.layout-footer').isVisible();
    expect(layoutFooter).toBe(true);
  });

  test('✅ パネル切り替えが機能する', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // Downloadパネルに切り替え
    await page.click('[data-menu-item="download"]');

    // Downloadパネルがアクティブになったか確認
    const downloadActive = await page.locator('[data-menu-item="download"].active').isVisible();
    expect(downloadActive).toBe(true);

    // Downloadパネルが表示されているか確認
    const downloadPanel = await page.locator('[data-panel="download"]').isVisible();
    expect(downloadPanel).toBe(true);

    // ステータスバーの表示が更新されたか確認
    const currentPanel = await page.locator('.current-panel').textContent();
    expect(currentPanel).toContain('Download');
  });

  test('✅ 各パネルが独立して表示される', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    const panels = ['download', 'explore', 'log', 'setting'];

    for (const panel of panels) {
      // パネルに切り替え
      await page.click(`[data-menu-item="${panel}"]`);
      await page.waitForTimeout(100);

      // 該当パネルのみが表示されているか確認
      for (const p of panels) {
        const panelVisible = await page.locator(`[data-panel="${p}"]`).isVisible();
        if (p === panel) {
          expect(panelVisible).toBe(true);
        } else {
          expect(panelVisible).toBe(false);
        }
      }
    }
  });

  test('✅ ウィンドウサイズが適切である', async () => {
    const page = electronApp.getWindow();

    const viewportSize = await page.viewportSize();
    expect(viewportSize).toBeTruthy();

    if (viewportSize) {
      expect(viewportSize.width).toBeGreaterThanOrEqual(800);
      expect(viewportSize.height).toBeGreaterThanOrEqual(600);
    }
  });
});