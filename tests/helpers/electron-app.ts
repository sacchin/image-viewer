import { _electron as electron, ElectronApplication, Page } from 'playwright';
import * as path from 'path';

export class ElectronAppHelper {
  private app: ElectronApplication | null = null;
  private window: Page | null = null;

  async launch(): Promise<void> {
    const mainPath = path.join(__dirname, '../../dist/main/index.js');

    const env = {
      ...process.env,
      NODE_ENV: 'test',
      IS_TEST: 'true'
    } as NodeJS.ProcessEnv;

    if ('ELECTRON_RUN_AS_NODE' in env) {
      delete env.ELECTRON_RUN_AS_NODE;
    }

    this.app = await electron.launch({
      args: [mainPath],
      env
    });

    this.window = await this.app.firstWindow();

    await this.window.waitForLoadState('domcontentloaded');
  }

  async close(): Promise<void> {
    if (this.app) {
      await this.app.close();
      this.app = null;
      this.window = null;
    }
  }

  getApp(): ElectronApplication {
    if (!this.app) {
      throw new Error('Electron app is not launched');
    }
    return this.app;
  }

  getWindow(): Page {
    if (!this.window) {
      throw new Error('Window is not available');
    }
    return this.window;
  }

  async getWindowTitle(): Promise<string> {
    const window = this.getWindow();
    return await window.title();
  }

  async getWindowSize(): Promise<{ width: number; height: number }> {
    const window = this.getWindow();
    const size = await window.evaluate(() => {
      return {
        width: window.outerWidth,
        height: window.outerHeight
      };
    });
    return size;
  }

  async takeScreenshot(name: string): Promise<void> {
    const window = this.getWindow();
    await window.screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true
    });
  }

  async waitForSelector(selector: string, timeout: number = 5000): Promise<void> {
    const window = this.getWindow();
    await window.waitForSelector(selector, { timeout });
  }

  async isVisible(selector: string): Promise<boolean> {
    const window = this.getWindow();
    return await window.isVisible(selector);
  }

  async getText(selector: string): Promise<string> {
    const window = this.getWindow();
    return await window.textContent(selector) || '';
  }

  async click(selector: string): Promise<void> {
    const window = this.getWindow();
    await window.click(selector);
  }

  async getMenuItems(): Promise<any> {
    const app = this.getApp();
    return await app.evaluate(async ({ Menu }) => {
      const menu = Menu.getApplicationMenu();
      if (!menu) return null;

      const menuItems = menu.items.map(item => ({
        label: item.label,
        visible: item.visible,
        enabled: item.enabled,
        submenu: item.submenu ? item.submenu.items.map(sub => ({
          label: sub.label,
          visible: sub.visible,
          enabled: sub.enabled
        })) : null
      }));

      return menuItems;
    });
  }
}
