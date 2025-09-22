import { test, expect } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';

test.describe('Side Menu Navigation', () => {
  let electronApp: ElectronAppHelper;

  test.beforeEach(async () => {
    electronApp = new ElectronAppHelper();
    await electronApp.launch();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('✅ サイドメニューが表示される', async () => {
    const window = electronApp.getWindow();

    // サイドメニューコンテナの存在確認
    await electronApp.waitForSelector('.side-menu');
    const isVisible = await electronApp.isVisible('.side-menu');
    expect(isVisible).toBe(true);
  });

  test('✅ 4つのメニュー項目が表示される', async () => {
    const window = electronApp.getWindow();

    // 各メニュー項目の存在確認
    const menuItems = [
      { selector: '[data-menu-item="download"]', label: 'Download' },
      { selector: '[data-menu-item="explore"]', label: 'Explore' },
      { selector: '[data-menu-item="log"]', label: 'Log' },
      { selector: '[data-menu-item="setting"]', label: 'Setting' }
    ];

    for (const item of menuItems) {
      await electronApp.waitForSelector(item.selector);
      const isVisible = await electronApp.isVisible(item.selector);
      expect(isVisible).toBe(true);

      const text = await electronApp.getText(item.selector);
      expect(text).toContain(item.label);
    }
  });

  test('✅ デフォルトでExploreパネルがアクティブ', async () => {
    const window = electronApp.getWindow();

    // Exploreメニュー項目がアクティブ状態であることを確認
    const exploreItem = await window.$('[data-menu-item="explore"]');
    const className = await exploreItem?.getAttribute('class');
    expect(className).toContain('active');

    // Exploreパネルが表示されていることを確認
    const explorePanel = await window.$('[data-panel="explore"]');
    const isVisible = await explorePanel?.isVisible();
    expect(isVisible).toBe(true);
  });

  test('✅ メニュー項目をクリックするとアクティブ状態が変わる', async () => {
    const window = electronApp.getWindow();

    // Downloadメニューをクリック
    await electronApp.click('[data-menu-item="download"]');

    // Downloadがアクティブになることを確認
    const downloadItem = await window.$('[data-menu-item="download"]');
    const downloadClass = await downloadItem?.getAttribute('class');
    expect(downloadClass).toContain('active');

    // Exploreが非アクティブになることを確認
    const exploreItem = await window.$('[data-menu-item="explore"]');
    const exploreClass = await exploreItem?.getAttribute('class');
    expect(exploreClass).not.toContain('active');
  });

  test('✅ メニュー項目のホバー効果が動作する', async () => {
    const window = electronApp.getWindow();

    // Logメニューにホバー
    const logItem = await window.$('[data-menu-item="log"]');
    await logItem?.hover();

    // ホバー状態のスタイル確認（背景色の変化など）
    const hoverStyle = await logItem?.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // ホバーを解除
    await window.mouse.move(0, 0);

    const normalStyle = await logItem?.evaluate((el) => {
      return window.getComputedStyle(el).backgroundColor;
    });

    // ホバー時と通常時でスタイルが異なることを確認
    expect(hoverStyle).not.toEqual(normalStyle);
  });

  test('✅ キーボードナビゲーションが動作する', async () => {
    const window = electronApp.getWindow();

    // Exploreメニューにフォーカス
    await window.focus('[data-menu-item="explore"]');

    // 下矢印キーでLogに移動
    await window.keyboard.press('ArrowDown');
    const logItem = await window.$('[data-menu-item="log"]');
    const isLogFocused = await logItem?.evaluate((el) => el === document.activeElement);
    expect(isLogFocused).toBe(true);

    // 上矢印キーでExploreに戻る
    await window.keyboard.press('ArrowUp');
    const exploreItem = await window.$('[data-menu-item="explore"]');
    const isExploreFocused = await exploreItem?.evaluate((el) => el === document.activeElement);
    expect(isExploreFocused).toBe(true);

    // Enterキーでパネルを切り替え
    await window.keyboard.press('Enter');
    const explorePanel = await window.$('[data-panel="explore"]');
    const isPanelVisible = await explorePanel?.isVisible();
    expect(isPanelVisible).toBe(true);
  });

  test('✅ サイドメニューの幅が適切', async () => {
    const window = electronApp.getWindow();

    const sideMenu = await window.$('.side-menu');
    const width = await sideMenu?.evaluate((el) => {
      return el.getBoundingClientRect().width;
    });

    // サイドメニューの幅が200px以上250px以下であることを確認
    expect(width).toBeGreaterThanOrEqual(200);
    expect(width).toBeLessThanOrEqual(250);
  });

  test('✅ メニューアイコンが表示される', async () => {
    const window = electronApp.getWindow();

    const menuItems = [
      { selector: '[data-menu-item="download"] .menu-icon', icon: 'download' },
      { selector: '[data-menu-item="explore"] .menu-icon', icon: 'explore' },
      { selector: '[data-menu-item="log"] .menu-icon', icon: 'log' },
      { selector: '[data-menu-item="setting"] .menu-icon', icon: 'setting' }
    ];

    for (const item of menuItems) {
      const iconElement = await window.$(item.selector);
      const isVisible = await iconElement?.isVisible();
      expect(isVisible).toBe(true);

      // アイコンが適切なサイズであることを確認
      const size = await iconElement?.evaluate((el) => {
        const rect = el.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      });

      expect(size?.width).toBeGreaterThanOrEqual(16);
      expect(size?.width).toBeLessThanOrEqual(24);
      expect(size?.height).toBeGreaterThanOrEqual(16);
      expect(size?.height).toBeLessThanOrEqual(24);
    }
  });

  test('✅ メニュー項目の間隔が適切', async () => {
    const window = electronApp.getWindow();

    const menuItems = await window.$$('.side-menu-item');
    const positions = [];

    for (const item of menuItems) {
      const rect = await item.boundingBox();
      if (rect) {
        positions.push(rect.y);
      }
    }

    // 隣接するメニュー項目の間隔を確認
    for (let i = 1; i < positions.length; i++) {
      const gap = positions[i] - positions[i - 1];
      // 間隔が40px以上60px以下であることを確認
      expect(gap).toBeGreaterThanOrEqual(40);
      expect(gap).toBeLessThanOrEqual(60);
    }
  });

  test('📸 サイドメニューのスクリーンショット', async () => {
    const window = electronApp.getWindow();

    // サイドメニューが完全に表示されるまで待機
    await electronApp.waitForSelector('.side-menu');
    await window.waitForTimeout(500); // アニメーション完了待ち

    // スクリーンショットを撮影
    await electronApp.takeScreenshot('side-menu-default');

    // 各メニューをアクティブにしてスクリーンショット
    const menuItems = ['download', 'explore', 'log', 'setting'];
    for (const item of menuItems) {
      await electronApp.click(`[data-menu-item="${item}"]`);
      await window.waitForTimeout(300); // アニメーション待ち
      await electronApp.takeScreenshot(`side-menu-${item}-active`);
    }
  });
});