import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface LaunchOptions {
  /**
   * Folder the app should treat as its download root. It is written into a
   * throw-away userData directory's settings.json before launch, so the app
   * starts with it already configured and whitelisted for file access, and
   * the developer's real settings are never touched.
   */
  downloadPath?: string;
}

export class ElectronAppHelper {
  private app: ElectronApplication | null = null;
  private window: Page | null = null;
  private userDataDir: string | null = null;

  async launch(options: LaunchOptions = {}): Promise<void> {
    const mainPath = path.join(__dirname, '../../dist/main/index.js');

    // Isolated userData so tests never read or pollute %APPDATA%\Electron
    this.userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'iv-udd-'));
    if (options.downloadPath) {
      fs.writeFileSync(
        path.join(this.userDataDir, 'settings.json'),
        JSON.stringify({ defaultDownloadPath: options.downloadPath }, null, 2)
      );
    }

    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (value !== undefined) {
        env[key] = value;
      }
    }
    // Inherited from the VSCode extension host; would make Electron run as plain Node
    delete env.ELECTRON_RUN_AS_NODE;
    env.NODE_ENV = 'test';
    env.IS_TEST = 'true';

    this.app = await electron.launch({
      args: [mainPath, `--user-data-dir=${this.userDataDir}`],
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
    if (this.userDataDir) {
      // Chromium may still be flushing caches; a leftover temp dir is harmless
      fs.rmSync(this.userDataDir, { recursive: true, force: true, maxRetries: 3 });
      this.userDataDir = null;
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
    return await this.getWindow().title();
  }

  /** Outer window size (what BrowserWindow was created with). page.viewportSize() is always null for Electron windows. */
  async getWindowSize(): Promise<{ width: number; height: number }> {
    return await this.getWindow().evaluate(() => ({
      width: window.outerWidth,
      height: window.outerHeight
    }));
  }

  /** Resize the BrowserWindow itself (there is no emulated viewport in Electron). */
  async setWindowSize(width: number, height: number): Promise<void> {
    await this.getApp().evaluate(({ BrowserWindow }, size) => {
      const [win] = BrowserWindow.getAllWindows();
      win.setSize(size.width, size.height);
    }, { width, height });
    await this.getWindow().waitForFunction(
      (size) => Math.abs(window.outerWidth - size.width) <= 2 && Math.abs(window.outerHeight - size.height) <= 2,
      { width, height },
      { timeout: 5000 }
    );
  }

  async takeScreenshot(name: string): Promise<void> {
    await this.getWindow().screenshot({
      path: `test-results/screenshots/${name}.png`,
      fullPage: true
    });
  }

  async waitForSelector(selector: string, timeout: number = 5000): Promise<void> {
    await this.getWindow().waitForSelector(selector, { timeout });
  }

  async isVisible(selector: string): Promise<boolean> {
    return await this.getWindow().isVisible(selector);
  }

  async getText(selector: string): Promise<string> {
    return (await this.getWindow().textContent(selector)) || '';
  }

  async click(selector: string): Promise<void> {
    await this.getWindow().click(selector);
  }
}
