import { test, expect } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';

test.describe('Panel Navigation', () => {
  let electronApp: ElectronAppHelper;

  test.beforeEach(async () => {
    electronApp = new ElectronAppHelper();
    await electronApp.launch();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('✅ Downloadパネルへの切り替え', async () => {
    const window = electronApp.getWindow();

    // Downloadメニューをクリック
    await electronApp.click('[data-menu-item="download"]');

    // Downloadパネルが表示される
    await electronApp.waitForSelector('[data-panel="download"]');
    const downloadPanel = await window.$('[data-panel="download"]');
    const isVisible = await downloadPanel?.isVisible();
    expect(isVisible).toBe(true);

    // 他のパネルが非表示になる
    const explorePanel = await window.$('[data-panel="explore"]');
    const isExploreVisible = await explorePanel?.isVisible();
    expect(isExploreVisible).toBe(false);
  });

  test('✅ Exploreパネルへの切り替え', async () => {
    const window = electronApp.getWindow();

    // 一旦別のパネルに切り替え
    await electronApp.click('[data-menu-item="log"]');
    await electronApp.waitForSelector('[data-panel="log"]');

    // Exploreメニューをクリック
    await electronApp.click('[data-menu-item="explore"]');

    // Exploreパネルが表示される
    await electronApp.waitForSelector('[data-panel="explore"]');
    const explorePanel = await window.$('[data-panel="explore"]');
    const isVisible = await explorePanel?.isVisible();
    expect(isVisible).toBe(true);

    // Exploreパネル内のコンポーネント確認
    const folderTree = await window.$('.folder-tree');
    const imageGrid = await window.$('.image-grid');
    expect(await folderTree?.isVisible()).toBe(true);
    expect(await imageGrid?.isVisible()).toBe(true);
  });

  test('✅ Logパネルへの切り替え', async () => {
    const window = electronApp.getWindow();

    // Logメニューをクリック
    await electronApp.click('[data-menu-item="log"]');

    // Logパネルが表示される
    await electronApp.waitForSelector('[data-panel="log"]');
    const logPanel = await window.$('[data-panel="log"]');
    const isVisible = await logPanel?.isVisible();
    expect(isVisible).toBe(true);

    // Logパネルのコンポーネント確認
    const logContainer = await window.$('.log-container');
    const logFilters = await window.$('.log-filters');
    expect(await logContainer?.isVisible()).toBe(true);
    expect(await logFilters?.isVisible()).toBe(true);
  });

  test('✅ Settingパネルへの切り替え', async () => {
    const window = electronApp.getWindow();

    // Settingメニューをクリック
    await electronApp.click('[data-menu-item="setting"]');

    // Settingパネルが表示される
    await electronApp.waitForSelector('[data-panel="setting"]');
    const settingPanel = await window.$('[data-panel="setting"]');
    const isVisible = await settingPanel?.isVisible();
    expect(isVisible).toBe(true);

    // Settingパネルのコンポーネント確認
    const settingsForm = await window.$('.settings-form');
    expect(await settingsForm?.isVisible()).toBe(true);
  });

  test('✅ パネル切り替え時のアニメーション', async () => {
    const window = electronApp.getWindow();

    // 初期状態を記録
    const initialPanel = await window.$('[data-panel="explore"]');
    const initialOpacity = await initialPanel?.evaluate((el) => {
      return window.getComputedStyle(el).opacity;
    });

    // パネルを切り替え
    await electronApp.click('[data-menu-item="download"]');

    // アニメーション中の状態を確認
    const transitioningPanel = await window.$('[data-panel="download"]');
    const transitionStyle = await transitioningPanel?.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return {
        transition: style.transition,
        opacity: style.opacity
      };
    });

    // トランジションが設定されていることを確認
    expect(transitionStyle?.transition).toContain('opacity');

    // アニメーション完了を待つ
    await window.waitForTimeout(500);

    // 最終状態を確認
    const finalOpacity = await transitioningPanel?.evaluate((el) => {
      return window.getComputedStyle(el).opacity;
    });
    expect(finalOpacity).toBe('1');
  });

  test('✅ Downloadパネルの初期コンテンツ', async () => {
    const window = electronApp.getWindow();

    await electronApp.click('[data-menu-item="download"]');
    await electronApp.waitForSelector('[data-panel="download"]');

    // ダウンロードフォームの存在確認
    const downloadForm = await window.$('.download-form');
    expect(await downloadForm?.isVisible()).toBe(true);

    // 必要な入力フィールドの確認
    const urlInput = await window.$('input[name="url"]');
    const pathInput = await window.$('input[name="savePath"]');
    const downloadButton = await window.$('button.download-start');

    expect(await urlInput?.isVisible()).toBe(true);
    expect(await pathInput?.isVisible()).toBe(true);
    expect(await downloadButton?.isVisible()).toBe(true);

    // ダウンロードキューエリアの確認
    const queueArea = await window.$('.download-queue');
    expect(await queueArea?.isVisible()).toBe(true);
  });

  test('✅ Logパネルのフィルタリング機能', async () => {
    const window = electronApp.getWindow();

    await electronApp.click('[data-menu-item="log"]');
    await electronApp.waitForSelector('[data-panel="log"]');

    // ログレベルフィルターの確認
    const filters = ['all', 'info', 'warning', 'error'];
    for (const filter of filters) {
      const filterButton = await window.$(`button[data-log-level="${filter}"]`);
      expect(await filterButton?.isVisible()).toBe(true);
      expect(await filterButton?.isEnabled()).toBe(true);
    }

    // クリアボタンの確認
    const clearButton = await window.$('button.clear-logs');
    expect(await clearButton?.isVisible()).toBe(true);
  });

  test('✅ Settingパネルの設定項目', async () => {
    const window = electronApp.getWindow();

    await electronApp.click('[data-menu-item="setting"]');
    await electronApp.waitForSelector('[data-panel="setting"]');

    // 設定カテゴリの確認
    const categories = ['general', 'appearance', 'downloads', 'advanced'];
    for (const category of categories) {
      const categorySection = await window.$(`[data-settings-category="${category}"]`);
      expect(await categorySection?.isVisible()).toBe(true);
    }

    // 保存ボタンとリセットボタンの確認
    const saveButton = await window.$('button.save-settings');
    const resetButton = await window.$('button.reset-settings');
    expect(await saveButton?.isVisible()).toBe(true);
    expect(await resetButton?.isVisible()).toBe(true);
  });

  test('✅ 連続したパネル切り替え', async () => {
    const window = electronApp.getWindow();

    const panels = ['download', 'log', 'setting', 'explore'];

    for (const panel of panels) {
      // パネルを切り替え
      await electronApp.click(`[data-menu-item="${panel}"]`);

      // パネルが表示されるまで待つ
      await electronApp.waitForSelector(`[data-panel="${panel}"]`);

      // パネルが表示されていることを確認
      const currentPanel = await window.$(`[data-panel="${panel}"]`);
      const isVisible = await currentPanel?.isVisible();
      expect(isVisible).toBe(true);

      // 他のパネルが非表示であることを確認
      for (const otherPanel of panels) {
        if (otherPanel !== panel) {
          const other = await window.$(`[data-panel="${otherPanel}"]`);
          const isOtherVisible = await other?.isVisible();
          expect(isOtherVisible).toBe(false);
        }
      }
    }
  });

  test('✅ パネルのスクロール動作', async () => {
    const window = electronApp.getWindow();

    // Logパネルでスクロールをテスト
    await electronApp.click('[data-menu-item="log"]');
    await electronApp.waitForSelector('[data-panel="log"]');

    const logContainer = await window.$('.log-container');

    // スクロール可能であることを確認
    const scrollHeight = await logContainer?.evaluate((el) => el.scrollHeight);
    const clientHeight = await logContainer?.evaluate((el) => el.clientHeight);

    // コンテンツが十分にある場合、スクロール可能
    if (scrollHeight && clientHeight && scrollHeight > clientHeight) {
      // スクロールダウン
      await logContainer?.evaluate((el) => {
        el.scrollTop = el.scrollHeight;
      });

      const scrollTop = await logContainer?.evaluate((el) => el.scrollTop);
      expect(scrollTop).toBeGreaterThan(0);
    }
  });

  test('✅ パネル切り替え時のフォーカス管理', async () => {
    const window = electronApp.getWindow();

    // Downloadパネルに切り替えてフォーカスを確認
    await electronApp.click('[data-menu-item="download"]');
    await electronApp.waitForSelector('[data-panel="download"]');

    // 最初の入力フィールドにフォーカスがあることを確認
    const urlInput = await window.$('input[name="url"]');
    const isFocused = await urlInput?.evaluate((el) => el === document.activeElement);
    expect(isFocused).toBe(true);
  });

  test('📸 各パネルのスクリーンショット', async () => {
    const window = electronApp.getWindow();

    const panels = ['download', 'explore', 'log', 'setting'];

    for (const panel of panels) {
      await electronApp.click(`[data-menu-item="${panel}"]`);
      await electronApp.waitForSelector(`[data-panel="${panel}"]`);
      await window.waitForTimeout(500); // アニメーション完了待ち

      await electronApp.takeScreenshot(`panel-${panel}`);
    }
  });
});