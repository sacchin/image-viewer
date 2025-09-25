import * as path from 'path';
import * as os from 'os';
import { app } from 'electron';
import * as fs from 'fs';

interface AppSettings {
  defaultDownloadPath: string;
}

const DEFAULT_DOWNLOAD_PATH = path.join(os.homedir(), 'Downloads');

class SettingsManager {
  private configPath: string | null = null;
  private settings: AppSettings;

  constructor() {
    // Initialize with defaults, actual loading happens in init()
    this.settings = this.getDefaults();
  }

  private ensureInitialized(): void {
    if (!this.configPath) {
      // Use Electron's app data directory for settings
      const userDataPath = app.getPath('userData');
      this.configPath = path.join(userDataPath, 'settings.json');

      // Load settings or use defaults
      this.settings = this.loadSettings();
    }
  }

  private loadSettings(): AppSettings {
    try {
      if (this.configPath && fs.existsSync(this.configPath)) {
        const data = fs.readFileSync(this.configPath, 'utf8');
        return { ...this.getDefaults(), ...JSON.parse(data) };
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
    return this.getDefaults();
  }

  private getDefaults(): AppSettings {
    return {
      defaultDownloadPath: DEFAULT_DOWNLOAD_PATH
    };
  }

  private saveToFile(): void {
    this.ensureInitialized();
    try {
      if (this.configPath) {
        const userDataPath = app.getPath('userData');
        if (!fs.existsSync(userDataPath)) {
          fs.mkdirSync(userDataPath, { recursive: true });
        }
        fs.writeFileSync(this.configPath, JSON.stringify(this.settings, null, 2));
      }
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  getSettings(): AppSettings {
    this.ensureInitialized();
    return { ...this.settings };
  }

  setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
    this.ensureInitialized();
    this.settings[key] = value;
    this.saveToFile();
  }

  saveSettings(settings: AppSettings): void {
    this.ensureInitialized();
    this.settings = { ...settings };
    this.saveToFile();
  }

  resetToDefaults(): void {
    this.ensureInitialized();
    this.settings = this.getDefaults();
    this.saveToFile();
  }

  getDefaultDownloadPath(): string {
    return DEFAULT_DOWNLOAD_PATH;
  }
}

export const settingsManager = new SettingsManager();