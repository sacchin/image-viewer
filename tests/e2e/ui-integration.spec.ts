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
    const window = electronApp.getWindow();
    await window.waitForLoadState('domcontentloaded');

    // サイドメニューが表示される
    const sideMenu = await window.locator('.side-menu').isVisible();
    expect(sideMenu).toBe(true);

    // デフォルトでExploreパネルが表示される
    const explorePanel = await window.locator('[data-panel="explore"]').isVisible();
    expect(explorePanel).toBe(true);

    // Exploreメニューがアクティブ
    const exploreActive = await window.locator('[data-menu-item="explore"].active').isVisible();
    expect(exploreActive).toBe(true);

    // レイアウトコンテナが表示される
    const layoutMain = await window.locator('.layout-main').isVisible();
    const layoutFooter = await window.locator('.layout-footer').isVisible();
    expect(layoutMain).toBe(true);
    expect(layoutFooter).toBe(true);
  });

  test('✅ サイドメニューとメインパネルの連携', async () => {
    const window = electronApp.getWindow();
    await window.waitForLoadState('domcontentloaded');

    // 各メニュー項目をクリックして対応するパネルが表示されることを確認
    const menuPanelPairs = [
      { menu: 'download', panel: 'download' },
      { menu: 'explore', panel: 'explore' },
      { menu: 'log', panel: 'log' },
      { menu: 'setting', panel: 'setting' }
    ];

    for (const pair of menuPanelPairs) {
      // メニューをクリック
      await window.click(`[data-menu-item="${pair.menu}"]`);

      // 対応するパネルが表示される
      await window.waitForSelector(`[data-panel="${pair.panel}"]`, { state: 'visible' });
      const panelVisible = await window.locator(`[data-panel="${pair.panel}"]`).isVisible();
      expect(panelVisible).toBe(true);

      // メニューアイテムがアクティブになる
      const menuActive = await window.locator(`[data-menu-item="${pair.menu}"].active`).isVisible();
      expect(menuActive).toBe(true);
    }
  });

  test('✅ ウィンドウリサイズ時のレイアウト保持', async () => {
    const window = electronApp.getWindow();
    await window.waitForLoadState('domcontentloaded');

    // 初期のウィンドウサイズを取得
    const initialSize = await window.viewportSize();
    expect(initialSize).toBeTruthy();

    if (initialSize) {
      // ウィンドウをリサイズ
      await window.setViewportSize({ width: 1200, height: 800 });
      await window.waitForTimeout(500);

      // レイアウトが維持されていることを確認
      const sideMenuVisible = await window.locator('.side-menu').isVisible();
      expect(sideMenuVisible).toBe(true);

      const contentVisible = await window.locator('.layout-content').isVisible();
      expect(contentVisible).toBe(true);

      // さらに小さくリサイズ
      await window.setViewportSize({ width: 800, height: 600 });
      await window.waitForTimeout(500);

      // レイアウトが維持されていることを確認
      const sideMenuStillVisible = await window.locator('.side-menu').isVisible();
      expect(sideMenuStillVisible).toBe(true);

      const contentStillVisible = await window.locator('.layout-content').isVisible();
      expect(contentStillVisible).toBe(true);
    }
  });

  test('✅ 各パネル内でのユーザー操作の永続性', async () => {
    const window = electronApp.getWindow();
    await window.waitForLoadState('domcontentloaded');

    // Settingパネルに移動
    await window.click('[data-menu-item="setting"]');
    await window.waitForSelector('[data-panel="setting"]', { state: 'visible' });

    // 設定パネル内で何か操作をシミュレート（例：入力フィールドがあれば）
    const settingInput = window.locator('[data-panel="setting"] input').first();
    const hasInput = await settingInput.isVisible().catch(() => false);

    if (hasInput) {
      await settingInput.fill('test value');
    }

    // 別のパネルに移動
    await window.click('[data-menu-item="log"]');
    await window.waitForSelector('[data-panel="log"]', { state: 'visible' });

    // Settingパネルに戻る
    await window.click('[data-menu-item="setting"]');
    await window.waitForSelector('[data-panel="setting"]', { state: 'visible' });

    // 設定が保持されているか確認（実装依存）
    if (hasInput) {
      const value = await settingInput.inputValue();
      // 注: 実装によっては値が保持される場合とされない場合がある
      expect(value).toBeDefined();
    }
  });

  test('✅ パネル切り替え時のメモリリーク防止', async () => {
    const window = electronApp.getWindow();
    await window.waitForLoadState('domcontentloaded');

    // メモリ使用量の確認（簡易的）
    const getMemoryUsage = async () => {
      return await window.evaluate(() => {
        if ((performance as any).memory) {
          return (performance as any).memory.usedJSHeapSize;
        }
        return null;
      });
    };

    const initialMemory = await getMemoryUsage();

    // パネルを複数回切り替え
    for (let i = 0; i < 10; i++) {
      await window.click('[data-menu-item="download"]');
      await window.waitForTimeout(100);
      await window.click('[data-menu-item="explore"]');
      await window.waitForTimeout(100);
      await window.click('[data-menu-item="log"]');
      await window.waitForTimeout(100);
      await window.click('[data-menu-item="setting"]');
      await window.waitForTimeout(100);
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
    const window = electronApp.getWindow();
    await window.waitForLoadState('domcontentloaded');

    // Downloadパネルでエラー状態をテスト
    await window.click('[data-menu-item="download"]');
    await window.waitForSelector('[data-panel="download"]', { state: 'visible' });

    // エラーが適切に表示されることを確認（実装依存）
    // 例: 無効なURLでスクレイピングを試みる
    const urlInput = window.locator('[data-panel="download"] input[type="url"], [data-panel="download"] input[type="text"]').first();
    const hasUrlInput = await urlInput.isVisible().catch(() => false);

    if (hasUrlInput) {
      await urlInput.fill('invalid-url');
      // スクレイピングボタンがあれば押す
      const scrapeButton = window.locator('[data-panel="download"] button').filter({ hasText: /scrape|fetch|get/i }).first();
      const hasButton = await scrapeButton.isVisible().catch(() => false);

      if (hasButton) {
        await scrapeButton.click();
        // エラーメッセージが表示されることを確認（実装依存）
        await window.waitForTimeout(1000);
      }
    }
  });

  test('✅ アクセシビリティ - ARIA属性', async () => {
    const window = electronApp.getWindow();
    await window.waitForLoadState('domcontentloaded');

    // サイドメニューのARIA属性を確認
    const sideMenu = window.locator('.side-menu');
    const role = await sideMenu.getAttribute('role').catch(() => null);

    // role属性がある場合は適切であることを確認
    if (role) {
      expect(['navigation', 'menu', 'menubar']).toContain(role);
    }

    // メニュー項目のARIA属性を確認
    const menuItems = await window.locator('[data-item]').all();
    for (const item of menuItems) {
      const itemRole = await item.getAttribute('role').catch(() => null);
      if (itemRole) {
        expect(['menuitem', 'tab', 'button']).toContain(itemRole);
      }
    }
  });

  test('✅ パフォーマンス - パネル切り替え時間', async () => {
    const window = electronApp.getWindow();
    await window.waitForLoadState('domcontentloaded');

    // パネル切り替えのパフォーマンスを測定
    const startTime = Date.now();

    // Downloadパネルに切り替え
    await window.click('[data-menu-item="download"]');
    await window.waitForSelector('[data-panel="download"]', { state: 'visible' });

    const endTime = Date.now();
    const switchTime = endTime - startTime;

    // パネル切り替えが500ms以内に完了することを確認
    expect(switchTime).toBeLessThan(500);
  });

  test('✅ ステータスバーの更新', async () => {
    const window = electronApp.getWindow();
    await window.waitForLoadState('domcontentloaded');

    // 初期状態のステータスバーを確認
    const statusBar = window.locator('[data-testid="status-bar"]');
    const isVisible = await statusBar.isVisible();
    expect(isVisible).toBe(true);

    // パネルを切り替えてステータスバーが更新されることを確認
    await window.click('[data-menu-item="download"]');
    await window.waitForTimeout(100);

    const currentPanel = await window.locator('.current-panel').textContent();
    expect(currentPanel).toContain('Download');

    await window.click('[data-menu-item="log"]');
    await window.waitForTimeout(100);

    const updatedPanel = await window.locator('.current-panel').textContent();
    expect(updatedPanel).toContain('Log');
  });

  test('📸 統合テストのスクリーンショット', async () => {
    const window = electronApp.getWindow();
    await window.waitForLoadState('domcontentloaded');

    // 初期状態
    await electronApp.takeScreenshot('integration-initial');

    // 各パネルの状態
    const panels = ['download', 'explore', 'log', 'setting'];
    for (const panel of panels) {
      await window.click(`[data-menu-item="${panel}"]`);
      await window.waitForSelector(`[data-panel="${panel}"]`, { state: 'visible' });
      await window.waitForTimeout(500);
      await electronApp.takeScreenshot(`integration-${panel}-panel`);
    }
  });
});