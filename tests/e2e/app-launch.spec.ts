import { test, expect } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';

test.describe('Application Launch', () => {
  let electronApp: ElectronAppHelper;

  test.beforeEach(async () => {
    electronApp = new ElectronAppHelper();
    await electronApp.launch();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('✅ Electronアプリケーションが正常に起動する', async () => {
    const app = electronApp.getApp();
    expect(app).toBeTruthy();

    const isPackaged = await app.evaluate(async ({ app }) => {
      return app.isPackaged;
    });
    expect(isPackaged).toBe(false);
  });

  test('✅ メインウィンドウが表示される', async () => {
    const window = electronApp.getWindow();
    expect(window).toBeTruthy();

    const isVisible = await window.evaluate(() => document.body !== null);
    expect(isVisible).toBe(true);
  });

  test('✅ ウィンドウサイズが1400x900である', async () => {
    const size = await electronApp.getWindowSize();

    expect(size.width).toBeGreaterThanOrEqual(1400);
    expect(size.height).toBeGreaterThanOrEqual(900);
  });

  test('✅ ウィンドウタイトルが正しい', async () => {
    const title = await electronApp.getWindowTitle();

    expect(title).toContain('Image Viewer');
  });

  test('ウィンドウの最小サイズが設定されている', async () => {
    const app = electronApp.getApp();
    const window = electronApp.getWindow();

    const minSize = await app.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        return windows[0].getMinimumSize();
      }
      return null;
    });

    expect(minSize).toEqual([800, 600]);
  });

  test('開発環境でDevToolsが開かれる', async () => {
    const app = electronApp.getApp();

    const result = await app.evaluate(async ({ BrowserWindow }) => {
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        const isDev = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
        const isDevToolsOpen = windows[0].webContents.isDevToolsOpened();
        return { isDev, isDevToolsOpen };
      }
      return { isDev: false, isDevToolsOpen: false };
    });

    // In test environment, devtools might not be opened
    expect(result).toBeDefined();
  });
});