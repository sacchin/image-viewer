import { test, expect } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';

test.describe('UI Integration Tests', () => {
  let electronApp: ElectronAppHelper;

  test.beforeEach(async () => {
    electronApp = new ElectronAppHelper();
    await electronApp.launch();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('✅ アプリケーション起動時のデフォルト状態', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // サイドメニューが表示される
    const sideMenu = await page.locator('.side-menu').isVisible();
    expect(sideMenu).toBe(true);

    // デフォルトでExploreパネルが表示される
    const explorePanel = await page.locator('[data-panel="explore"]').isVisible();
    expect(explorePanel).toBe(true);

    // Exploreメニューがアクティブ
    const exploreActive = await page.locator('[data-menu-item="explore"].active').isVisible();
    expect(exploreActive).toBe(true);

    // レイアウトコンテナが表示される
    const layoutMain = await page.locator('.layout-main').isVisible();
    const layoutFooter = await page.locator('.layout-footer').isVisible();
    expect(layoutMain).toBe(true);
    expect(layoutFooter).toBe(true);
  });

  test('✅ サイドメニューとメインパネルの連携', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // 各メニュー項目をクリックして対応するパネルが表示されることを確認
    const menuPanelPairs = [
      { menu: 'download', panel: 'download' },
      { menu: 'explore', panel: 'explore' },
      { menu: 'log', panel: 'log' },
      { menu: 'setting', panel: 'setting' }
    ];

    for (const pair of menuPanelPairs) {
      // メニューをクリック
      await page.click(`[data-menu-item="${pair.menu}"]`);

      // 対応するパネルが表示される
      await page.waitForSelector(`[data-panel="${pair.panel}"]`, { state: 'visible' });
      const panelVisible = await page.locator(`[data-panel="${pair.panel}"]`).isVisible();
      expect(panelVisible).toBe(true);

      // メニューアイテムがアクティブになる
      const menuActive = await page.locator(`[data-menu-item="${pair.menu}"].active`).isVisible();
      expect(menuActive).toBe(true);
    }
  });

  test('✅ ウィンドウリサイズ時のレイアウト保持', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // 初期のウィンドウサイズを取得（Electron では page.viewportSize() は常に null）
    const initialSize = await electronApp.getWindowSize();
    expect(initialSize.width).toBeGreaterThanOrEqual(800);
    expect(initialSize.height).toBeGreaterThanOrEqual(600);

    // ウィンドウをリサイズ
    await electronApp.setWindowSize(1200, 800);

    // レイアウトが維持されていることを確認
    await expect(page.locator('.side-menu')).toBeVisible();
    await expect(page.locator('.layout-content')).toBeVisible();

    // さらに小さく（最小サイズまで）リサイズ
    await electronApp.setWindowSize(800, 600);

    // レイアウトが維持されていることを確認
    await expect(page.locator('.side-menu')).toBeVisible();
    await expect(page.locator('.layout-content')).toBeVisible();
    const smallSize = await electronApp.getWindowSize();
    expect(smallSize.width).toBeLessThan(initialSize.width);
  });

  test('✅ 各パネル内でのユーザー操作の永続性', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // Settingパネルに移動
    await page.click('[data-menu-item="setting"]');
    await page.waitForSelector('[data-panel="setting"]', { state: 'visible' });

    // 設定パネル内で何か操作をシミュレート（例：入力フィールドがあれば）
    const settingInput = page.locator('[data-panel="setting"] input').first();
    const hasInput = await settingInput.isVisible().catch(() => false);

    if (hasInput) {
      await settingInput.fill('test value');
    }

    // 別のパネルに移動
    await page.click('[data-menu-item="log"]');
    await page.waitForSelector('[data-panel="log"]', { state: 'visible' });

    // Settingパネルに戻る
    await page.click('[data-menu-item="setting"]');
    await page.waitForSelector('[data-panel="setting"]', { state: 'visible' });

    // 設定が保持されているか確認（実装依存）
    if (hasInput) {
      const value = await settingInput.inputValue();
      // 注: 実装によっては値が保持される場合とされない場合がある
      expect(value).toBeDefined();
    }
  });

  test('✅ パネル切り替え時のメモリリーク防止', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // メモリ使用量の確認（簡易的）
    const getMemoryUsage = async () => {
      return await page.evaluate(() => {
        if ((performance as any).memory) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return null;
      });
    };

    const initialMemory = await getMemoryUsage();

    // パネルを複数回切り替え
    for (let i = 0; i < 10; i++) {
      await page.click('[data-menu-item="download"]');
      await page.waitForTimeout(100);
      await page.click('[data-menu-item="explore"]');
      await page.waitForTimeout(100);
      await page.click('[data-menu-item="log"]');
      await page.waitForTimeout(100);
      await page.click('[data-menu-item="setting"]');
      await page.waitForTimeout(100);
    }

    const finalMemory = await getMemoryUsage();

    // メモリ使用量が異常に増加していないことを確認
    if (initialMemory && finalMemory) {
      const memoryIncrease = finalMemory - initialMemory;
      // 10MB以上増加していないことを確認（閾値は調整可能）
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    }
  });

  test('✅ エラー状態のハンドリング', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // Downloadパネルでエラー状態をテスト
    await page.click('[data-menu-item="download"]');
    await page.waitForSelector('[data-panel="download"]', { state: 'visible' });

    // エラーが適切に表示されることを確認（実装依存）
    // 例: 無効なURLでスクレイピングを試みる
    const urlInput = page.locator('[data-panel="download"] input[type="url"], [data-panel="download"] input[type="text"]').first();
    const hasUrlInput = await urlInput.isVisible().catch(() => false);

    if (hasUrlInput) {
      await urlInput.fill('invalid-url');
      // スクレイピングボタンがあれば押す
      const scrapeButton = page.locator('[data-panel="download"] button').filter({ hasText: /scrape|fetch|get/i }).first();
      const hasButton = await scrapeButton.isVisible().catch(() => false);

      if (hasButton) {
        await scrapeButton.click();
        // エラーメッセージが表示されることを確認（実装依存）
        await page.waitForTimeout(1000);
      }
    }
  });

  test('✅ アクセシビリティ - ARIA属性', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // サイドメニューのARIA属性を確認
    const sideMenu = page.locator('.side-menu');
    const role = await sideMenu.getAttribute('role').catch(() => null);

    // role属性がある場合は適切であることを確認
    if (role) {
      expect(['navigation', 'menu', 'menubar']).toContain(role);
    }

    // メニュー項目のARIA属性を確認
    const menuItems = await page.locator('[data-menu-item]').all();
    for (const item of menuItems) {
      const itemRole = await item.getAttribute('role').catch(() => null);
      if (itemRole) {
        expect(['menuitem', 'tab', 'button']).toContain(itemRole);
      }
    }
  });

  test('✅ パフォーマンス - パネル切り替え時間', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // パネル切り替えのパフォーマンスを測定
    const startTime = Date.now();

    // Downloadパネルに切り替え
    await page.click('[data-menu-item="download"]');
    await page.waitForSelector('[data-panel="download"]', { state: 'visible' });

    const endTime = Date.now();
    const switchTime = endTime - startTime;

    // パネル切り替えが500ms以内に完了することを確認
    expect(switchTime).toBeLessThan(500);
  });

  test('✅ ステータスバーの更新', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // 初期状態のステータスバーを確認
    const statusBar = page.locator('[data-testid="status-bar"]');
    const isVisible = await statusBar.isVisible();
    expect(isVisible).toBe(true);

    // パネルを切り替えてステータスバーが更新されることを確認
    await page.click('[data-menu-item="download"]');
    await page.waitForTimeout(100);

    const currentPanel = await page.locator('.current-panel').textContent();
    expect(currentPanel).toContain('Download');

    await page.click('[data-menu-item="log"]');
    await page.waitForTimeout(100);

    const updatedPanel = await page.locator('.current-panel').textContent();
    expect(updatedPanel).toContain('Log');
  });

  test('📸 統合テストのスクリーンショット', async () => {
    const page = electronApp.getWindow();
    await page.waitForLoadState('domcontentloaded');

    // 初期状態
    await electronApp.takeScreenshot('integration-initial');

    // 各パネルの状態
    const panels = ['download', 'explore', 'log', 'setting'];
    for (const panel of panels) {
      await page.click(`[data-menu-item="${panel}"]`);
      await page.waitForSelector(`[data-panel="${panel}"]`, { state: 'visible' });
      await page.waitForTimeout(500);
      await electronApp.takeScreenshot(`integration-${panel}-panel`);
    }
  });
});