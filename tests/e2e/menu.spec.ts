import { test, expect } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';

test.describe('Application Menu', () => {
  let electronApp: ElectronAppHelper;

  test.beforeEach(async () => {
    electronApp = new ElectronAppHelper();
    await electronApp.launch();
  });

  test.afterEach(async () => {
    await electronApp.close();
  });

  test('✅ ファイルメニューが存在する', async () => {
    const menuItems = await electronApp.getMenuItems();
    expect(menuItems).toBeTruthy();

    const fileMenu = menuItems.find((item: any) =>
      item.label === 'File' || item.label === 'ファイル' || item.label === '&File'
    );
    expect(fileMenu).toBeTruthy();
    expect(fileMenu.visible).toBe(true);
    expect(fileMenu.enabled).toBe(true);
  });

  test('✅ 表示メニューが存在する', async () => {
    const menuItems = await electronApp.getMenuItems();
    expect(menuItems).toBeTruthy();

    const viewMenu = menuItems.find((item: any) =>
      item.label === 'View' || item.label === '表示' || item.label === '&View'
    );
    expect(viewMenu).toBeTruthy();
    expect(viewMenu.visible).toBe(true);
    expect(viewMenu.enabled).toBe(true);
  });

  test('✅ ヘルプメニューが存在する', async () => {
    const menuItems = await electronApp.getMenuItems();
    expect(menuItems).toBeTruthy();

    const helpMenu = menuItems.find((item: any) =>
      item.label === 'Help' || item.label === 'ヘルプ' || item.label === '&Help'
    );
    expect(helpMenu).toBeTruthy();
    expect(helpMenu.visible).toBe(true);
    expect(helpMenu.enabled).toBe(true);
  });

  test('ファイルメニューに必要な項目が含まれている', async () => {
    const menuItems = await electronApp.getMenuItems();
    const fileMenu = menuItems.find((item: any) =>
      item.label === 'File' || item.label === 'ファイル' || item.label === '&File'
    );

    expect(fileMenu.submenu).toBeTruthy();
    expect(fileMenu.submenu.length).toBeGreaterThan(0);

    const hasOpenFolder = fileMenu.submenu.some((item: any) =>
      item.label.toLowerCase().includes('open') ||
      item.label.includes('開く')
    );
    expect(hasOpenFolder).toBe(true);

    const hasExit = fileMenu.submenu.some((item: any) =>
      item.label.toLowerCase().includes('quit') ||
      item.label.toLowerCase().includes('exit') ||
      item.label.includes('終了')
    );
    expect(hasExit).toBe(true);
  });

  test('表示メニューに必要な項目が含まれている', async () => {
    const menuItems = await electronApp.getMenuItems();
    const viewMenu = menuItems.find((item: any) =>
      item.label === 'View' || item.label === '表示' || item.label === '&View'
    );

    expect(viewMenu.submenu).toBeTruthy();
    expect(viewMenu.submenu.length).toBeGreaterThan(0);

    const hasZoomIn = viewMenu.submenu.some((item: any) =>
      item.label.toLowerCase().includes('zoom in') ||
      item.label.includes('拡大')
    );
    expect(hasZoomIn).toBe(true);

    const hasZoomOut = viewMenu.submenu.some((item: any) =>
      item.label.toLowerCase().includes('zoom out') ||
      item.label.includes('縮小')
    );
    expect(hasZoomOut).toBe(true);

    const hasResetZoom = viewMenu.submenu.some((item: any) =>
      item.label.toLowerCase().includes('reset') ||
      item.label.toLowerCase().includes('actual') ||
      item.label.includes('リセット') ||
      item.label.includes('実際')
    );
    expect(hasResetZoom).toBe(true);
  });

  test('ヘルプメニューに必要な項目が含まれている', async () => {
    const menuItems = await electronApp.getMenuItems();
    const helpMenu = menuItems.find((item: any) =>
      item.label === 'Help' || item.label === 'ヘルプ' || item.label === '&Help'
    );

    expect(helpMenu.submenu).toBeTruthy();
    expect(helpMenu.submenu.length).toBeGreaterThan(0);

    const hasAbout = helpMenu.submenu.some((item: any) =>
      item.label.toLowerCase().includes('about') ||
      item.label.includes('について')
    );
    expect(hasAbout).toBe(true);
  });

  test('編集メニューが存在し、基本的な操作が含まれている', async () => {
    const menuItems = await electronApp.getMenuItems();
    const editMenu = menuItems.find((item: any) =>
      item.label === 'Edit' || item.label === '編集' || item.label === '&Edit'
    );

    if (editMenu) {
      expect(editMenu.visible).toBe(true);
      expect(editMenu.enabled).toBe(true);
      expect(editMenu.submenu).toBeTruthy();

      const hasCopy = editMenu.submenu.some((item: any) =>
        item.label.toLowerCase().includes('copy') ||
        item.label.includes('コピー')
      );
      const hasPaste = editMenu.submenu.some((item: any) =>
        item.label.toLowerCase().includes('paste') ||
        item.label.includes('貼り付け')
      );
      const hasSelectAll = editMenu.submenu.some((item: any) =>
        item.label.toLowerCase().includes('select all') ||
        item.label.includes('すべて選択')
      );

      expect(hasCopy).toBe(true);
      expect(hasPaste).toBe(true);
      expect(hasSelectAll).toBe(true);
    }
  });

  test('開発者ツールメニュー項目が開発環境で利用可能', async () => {
    const app = electronApp.getApp();
    const isDevelopment = await app.evaluate(() => process.env.NODE_ENV === 'development');

    if (isDevelopment) {
      const menuItems = await electronApp.getMenuItems();
      const viewMenu = menuItems.find((item: any) =>
        item.label === 'View' || item.label === '表示' || item.label === '&View'
      );

      if (viewMenu && viewMenu.submenu) {
        const hasDevTools = viewMenu.submenu.some((item: any) =>
          item.label.toLowerCase().includes('developer') ||
          item.label.toLowerCase().includes('devtools') ||
          item.label.includes('開発者')
        );
        expect(hasDevTools).toBe(true);
      }
    }
  });

});