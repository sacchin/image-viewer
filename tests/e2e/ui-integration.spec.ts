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

    // サイドメニューが表示される
    await electronApp.waitForSelector('.side-menu');
    const sideMenu = await window.$('.side-menu');
    expect(await sideMenu?.isVisible()).toBe(true);

    // デフォルトでExploreパネルが表示される
    const explorePanel = await window.$('[data-panel="explore"]');
    expect(await explorePanel?.isVisible()).toBe(true);

    // Exploreメニューがアクティブ
    const exploreMenuItem = await window.$('[data-menu-item="explore"]');
    const className = await exploreMenuItem?.getAttribute('class');
    expect(className).toContain('active');

    // ヘッダーとフッターが表示される
    const header = await window.$('.layout-header');
    const footer = await window.$('.layout-footer');
    expect(await header?.isVisible()).toBe(true);
    expect(await footer?.isVisible()).toBe(true);
  });

  test('✅ サイドメニューとメインパネルの連携', async () => {
    const window = electronApp.getWindow();

    // 各メニュー項目をクリックして対応するパネルが表示されることを確認
    const menuPanelPairs = [
      { menu: 'download', panel: 'download' },
      { menu: 'explore', panel: 'explore' },
      { menu: 'log', panel: 'log' },
      { menu: 'setting', panel: 'setting' }
    ];

    for (const pair of menuPanelPairs) {
      // メニューをクリック
      await electronApp.click(`[data-menu-item="${pair.menu}"]`);

      // 対応するパネルが表示される
      await electronApp.waitForSelector(`[data-panel="${pair.panel}"]`);
      const panel = await window.$(`[data-panel="${pair.panel}"]`);
      expect(await panel?.isVisible()).toBe(true);

      // メニューアイテムがアクティブになる
      const menuItem = await window.$(`[data-menu-item="${pair.menu}"]`);
      const className = await menuItem?.getAttribute('class');
      expect(className).toContain('active');
    }
  });

  test('✅ ウィンドウリサイズ時のレイアウト保持', async () => {
    const app = electronApp.getApp();
    const window = electronApp.getWindow();

    // 初期サイズを記録
    const initialSize = await electronApp.getWindowSize();

    // ウィンドウをリサイズ
    await app.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].setSize(1200, 800);
      }
    });

    await window.waitForTimeout(500); // リサイズ完了待ち

    // サイドメニューが維持されていることを確認
    const sideMenu = await window.$('.side-menu');
    expect(await sideMenu?.isVisible()).toBe(true);

    // メインコンテンツエリアが適切にリサイズされていることを確認
    const contentArea = await window.$('.layout-content');
    const contentSize = await contentArea?.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      return { width: rect.width, height: rect.height };
    });

    expect(contentSize?.width).toBeGreaterThan(0);
    expect(contentSize?.height).toBeGreaterThan(0);

    // 元のサイズに戻す
    await app.evaluate(async ({ BrowserWindow }, size) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].setSize(size.width, size.height);
      }
    }, initialSize);
  });

  test('✅ 各パネル内でのユーザー操作の永続性', async () => {
    const window = electronApp.getWindow();

    // Settingパネルで値を入力
    await electronApp.click('[data-menu-item="setting"]');
    await electronApp.waitForSelector('[data-panel="setting"]');

    // 設定値を入力
    const themeSelect = await window.$('select[name="theme"]');
    if (themeSelect) {
      await themeSelect.selectOption('dark');
    }

    // 別のパネルに移動
    await electronApp.click('[data-menu-item="explore"]');
    await electronApp.waitForSelector('[data-panel="explore"]');

    // Settingパネルに戻る
    await electronApp.click('[data-menu-item="setting"]');
    await electronApp.waitForSelector('[data-panel="setting"]');

    // 入力値が保持されていることを確認
    if (themeSelect) {
      const selectedValue = await themeSelect.evaluate((el: HTMLSelectElement) => el.value);
      expect(selectedValue).toBe('dark');
    }
  });

  test('✅ パネル切り替え時のメモリリーク防止', async () => {
    const app = electronApp.getApp();
    const window = electronApp.getWindow();

    // 初期メモリ使用量を記録
    const initialMemory = await app.evaluate(() => {
      return process.memoryUsage().heapUsed;
    });

    // 複数回パネルを切り替え
    const panels = ['download', 'explore', 'log', 'setting'];
    for (let i = 0; i < 10; i++) {
      for (const panel of panels) {
        await electronApp.click(`[data-menu-item="${panel}"]`);
        await window.waitForTimeout(100);
      }
    }

    // ガベージコレクションをトリガー（可能な場合）
    await app.evaluate(() => {
      if (global.gc) {
        global.gc();
      }
    });

    await window.waitForTimeout(1000);

    // 最終メモリ使用量を確認
    const finalMemory = await app.evaluate(() => {
      return process.memoryUsage().heapUsed;
    });

    // メモリ増加が許容範囲内であることを確認（50MB以内）
    const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
    expect(memoryIncrease).toBeLessThan(50);
  });

  test('✅ エラー状態のハンドリング', async () => {
    const window = electronApp.getWindow();

    // Downloadパネルでエラーをトリガー
    await electronApp.click('[data-menu-item="download"]');
    await electronApp.waitForSelector('[data-panel="download"]');

    // 無効なURLを入力
    const urlInput = await window.$('input[name="url"]');
    if (urlInput) {
      await urlInput.fill('invalid-url');

      // ダウンロードボタンをクリック
      const downloadButton = await window.$('button.download-start');
      await downloadButton?.click();

      // エラーメッセージが表示されることを確認
      await electronApp.waitForSelector('.error-message');
      const errorMessage = await window.$('.error-message');
      const errorText = await errorMessage?.textContent();
      expect(errorText).toContain('Invalid URL');
    }
  });

  test('✅ キーボードショートカット', async () => {
    const window = electronApp.getWindow();

    // Alt+1でDownloadパネル
    await window.keyboard.press('Alt+1');
    await window.waitForTimeout(300);
    let activePanel = await window.$('[data-panel]:not([style*="display: none"])');
    let panelName = await activePanel?.getAttribute('data-panel');
    expect(panelName).toBe('download');

    // Alt+2でExploreパネル
    await window.keyboard.press('Alt+2');
    await window.waitForTimeout(300);
    activePanel = await window.$('[data-panel]:not([style*="display: none"])');
    panelName = await activePanel?.getAttribute('data-panel');
    expect(panelName).toBe('explore');

    // Alt+3でLogパネル
    await window.keyboard.press('Alt+3');
    await window.waitForTimeout(300);
    activePanel = await window.$('[data-panel]:not([style*="display: none"])');
    panelName = await activePanel?.getAttribute('data-panel');
    expect(panelName).toBe('log');

    // Alt+4でSettingパネル
    await window.keyboard.press('Alt+4');
    await window.waitForTimeout(300);
    activePanel = await window.$('[data-panel]:not([style*="display: none"])');
    panelName = await activePanel?.getAttribute('data-panel');
    expect(panelName).toBe('setting');
  });

  test('✅ アクセシビリティ - ARIA属性', async () => {
    const window = electronApp.getWindow();

    // サイドメニューのARIA属性
    const sideMenu = await window.$('.side-menu');
    const sideMenuRole = await sideMenu?.getAttribute('role');
    expect(sideMenuRole).toBe('navigation');

    // メニュー項目のARIA属性
    const menuItems = await window.$$('[data-menu-item]');
    for (const item of menuItems) {
      const role = await item.getAttribute('role');
      const tabIndex = await item.getAttribute('tabindex');
      expect(role).toBe('button');
      expect(tabIndex).toBe('0');
    }

    // パネルのARIA属性
    const panels = await window.$$('[data-panel]');
    for (const panel of panels) {
      const role = await panel.getAttribute('role');
      expect(role).toBe('tabpanel');
    }
  });

  test('✅ パフォーマンス - パネル切り替え時間', async () => {
    const window = electronApp.getWindow();

    const measurements = [];

    for (let i = 0; i < 5; i++) {
      // Downloadパネルへの切り替え時間を測定
      const startTime = Date.now();
      await electronApp.click('[data-menu-item="download"]');
      await electronApp.waitForSelector('[data-panel="download"]:visible');
      const endTime = Date.now();

      measurements.push(endTime - startTime);

      // 次のテストのために別のパネルに切り替え
      await electronApp.click('[data-menu-item="explore"]');
      await window.waitForTimeout(200);
    }

    // 平均切り替え時間を計算
    const averageTime = measurements.reduce((a, b) => a + b, 0) / measurements.length;

    // パネル切り替えが500ms以内に完了することを確認
    expect(averageTime).toBeLessThan(500);
  });

  test('✅ ステータスバーの更新', async () => {
    const window = electronApp.getWindow();

    // 各パネルでステータスバーが適切に更新されることを確認
    const panels = [
      { name: 'download', expectedStatus: 'Download' },
      { name: 'explore', expectedStatus: 'Explore' },
      { name: 'log', expectedStatus: 'Log' },
      { name: 'setting', expectedStatus: 'Setting' }
    ];

    for (const panel of panels) {
      await electronApp.click(`[data-menu-item="${panel.name}"]`);
      await electronApp.waitForSelector(`[data-panel="${panel.name}"]`);

      const statusBar = await window.$('.status-bar .current-panel');
      const statusText = await statusBar?.textContent();
      expect(statusText).toContain(panel.expectedStatus);
    }
  });

  test('📸 統合テストのスクリーンショット', async () => {
    const window = electronApp.getWindow();

    // デフォルト状態
    await electronApp.takeScreenshot('integration-default-state');

    // 各パネルとの組み合わせ
    const panels = ['download', 'explore', 'log', 'setting'];
    for (const panel of panels) {
      await electronApp.click(`[data-menu-item="${panel}"]`);
      await window.waitForTimeout(500);
      await electronApp.takeScreenshot(`integration-${panel}-panel`);
    }

    // ウィンドウリサイズ後
    const app = electronApp.getApp();
    await app.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        windows[0].setSize(1600, 1000);
      }
    });
    await window.waitForTimeout(500);
    await electronApp.takeScreenshot('integration-resized');
  });
});