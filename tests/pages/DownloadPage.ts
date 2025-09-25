import { Page, Locator } from '@playwright/test';

export interface CrawlJobStub {
  jobId: string;
  title: string;
  totalImages: number;
  imageUrls: string[];
}

export interface JobCard {
  title(): Locator;
  progressText(): Locator;
  progressBar(): Locator;
  status(): Locator;
}

export interface ProgressEvent {
  jobId: string;
  completed: number;
  total: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  message?: string;
}

export interface MockFileSystem {
  folders: Set<string>;
  files: Map<string, { path: string; content?: string }>;
  existingFolders: Set<string>;
}

export interface DownloadSettings {
  defaultDownloadPath: string;
}

export class DownloadPage {
  private page: Page;
  private fetchStub: any = null;
  private electronApiStub: any = null;
  private fetchCallCount: number = 0;
  private startCalls: string[] = [];

  constructor(page: Page) {
    this.page = page;
  }

  async openDownloadPanel(): Promise<void> {
    // Click on the Download button in the side menu
    await this.page.click('[data-testid="side-menu-download"]');
    await this.page.waitForSelector('[data-testid="download-panel"]', { timeout: 5000 });
  }

  async openCreateJobDialog(): Promise<void> {
    await this.page.click('[data-testid="download-panel-create-job"]');
    await this.page.waitForSelector('[data-testid="download-dialog"]', { timeout: 5000 });
  }

  async fillUrl(url: string): Promise<void> {
    const input = this.page.locator('[data-testid="download-dialog-url-input"]');
    await input.fill(url);
  }

  async getUrlValue(): Promise<string> {
    const input = this.page.locator('[data-testid="download-dialog-url-input"]');
    return await input.inputValue();
  }

  async triggerScrape(): Promise<void> {
    await this.page.click('[data-testid="download-dialog-scrape-button"]');
  }

  async triggerStart(): Promise<void> {
    await this.page.click('[data-testid="download-dialog-start-button"]');
  }

  async triggerCancel(): Promise<void> {
    await this.page.click('[data-testid="download-dialog-cancel-button"]');
  }

  async waitForScrapeResult(): Promise<void> {
    await this.page.waitForSelector('[data-testid="download-dialog-scrape-result"]', { timeout: 5000 });
  }

  async waitForError(): Promise<void> {
    await this.page.waitForSelector('[data-testid="download-dialog-error"]', { timeout: 5000 });
  }

  async waitForDialogToClose(): Promise<void> {
    await this.page.waitForSelector('[data-testid="download-dialog"]', { state: 'hidden', timeout: 5000 });
  }

  async waitForJobCard(jobId: string): Promise<void> {
    await this.page.waitForSelector(`[data-testid="job-card-${jobId}"]`, { timeout: 5000 });
  }

  async getScrapeTitle(): Promise<string> {
    const element = this.page.locator('[data-testid="download-dialog-scrape-title"]');
    return await element.textContent() || '';
  }

  async getScrapePageCount(): Promise<string> {
    const element = this.page.locator('[data-testid="download-dialog-scrape-page-count"]');
    return await element.textContent() || '';
  }

  async getScrapeImageCount(): Promise<number> {
    return await this.page.evaluate(() => {
      const result = (window as any).__scrapeResult;
      return result ? result.imageUrls.length : 0;
    });
  }

  async getErrorMessage(): Promise<string> {
    const element = this.page.locator('[data-testid="download-dialog-error"]');
    return await element.textContent() || '';
  }

  async isStartEnabled(): Promise<boolean> {
    const button = this.page.locator('[data-testid="download-dialog-start-button"]');
    return await button.isEnabled();
  }

  async hasScrapeResult(): Promise<boolean> {
    const element = this.page.locator('[data-testid="download-dialog-scrape-result"]');
    return await element.isVisible();
  }

  async getJobCard(jobId: string): Promise<JobCard> {
    const card = this.page.locator(`[data-testid="job-card-${jobId}"]`);

    return {
      title: () => card.locator('[data-testid="job-card-title"]'),
      progressText: () => card.locator('[data-testid="job-card-progress-text"]'),
      progressBar: () => card.locator('[data-testid="job-card-progress-bar"]'),
      status: () => card.locator('[data-testid="job-card-status"]')
    };
  }

  async stubFetchWithHtml(html: string): Promise<void> {
    this.fetchCallCount = 0;

    await this.page.evaluate((htmlContent) => {
      (window as any).__fetchCallCount = 0;

      // Ensure electronAPI exists
      if (!window.electronAPI) {
        console.warn('electronAPI not found, creating mock');
        (window as any).electronAPI = {};
      }

      // Override the fetchUrl method completely
      console.log('Overriding electronAPI.fetchUrl with mock');

      // Simply replace the function rather than using defineProperty
      window.electronAPI.fetchUrl = async (url: string) => {
        (window as any).__fetchCallCount++;
        console.log('Mock fetchUrl called with:', url);
        console.log('Returning HTML with length:', htmlContent.length);

        // Store the scraped result globally for test assertions
        const result = {
          success: true,
          html: htmlContent
        };

        return result;
      };

      console.log('Mock fetchUrl installed successfully');
    }, html);

    // Wait a bit to ensure the mock is set up
    await this.page.waitForTimeout(100);
  }

  async stubFetchWithError(errorMessage: string): Promise<void> {
    this.fetchCallCount = 0;

    await this.page.evaluate((message) => {
      (window as any).__fetchCallCount = 0;

      // Ensure electronAPI exists
      if (!window.electronAPI) {
        console.warn('electronAPI not found, creating mock');
        (window as any).electronAPI = {};
      }

      // Override the fetchUrl method completely
      console.log('Overriding electronAPI.fetchUrl with error mock');

      // Simply replace the function rather than using defineProperty
      window.electronAPI.fetchUrl = async (url: string) => {
        (window as any).__fetchCallCount++;
        console.log('Mock fetchUrl error called with:', url);
        console.log('Returning error:', message);

        return {
          success: false,
          error: message
        };
      };

      console.log('Mock error fetchUrl installed successfully');
    }, errorMessage);

    // Wait a bit to ensure the mock is set up
    await this.page.waitForTimeout(100);
  }

  async getFetchCallCount(): Promise<number> {
    return await this.page.evaluate(() => (window as any).__fetchCallCount || 0);
  }

  async setupCrawlStubs(...jobs: CrawlJobStub[]): Promise<void> {
    this.startCalls = [];

    await this.page.evaluate((jobList) => {
      (window as any).__startCalls = [];
      (window as any).__crawlJobs = jobList;
      (window as any).__progressListeners = [];

      // Stub the Electron IPC API
      if (!(window as any).electronAPI) {
        (window as any).electronAPI = {};
      }

      (window as any).electronAPI.startCrawl = async (url: string, data: any) => {
        (window as any).__startCalls.push(url);

        const job = (window as any).__crawlJobs.find((j: any) =>
          url.includes('gallery/A') ? j.jobId === 'job-a' :
          url.includes('gallery/B') ? j.jobId === 'job-b' :
          j === (window as any).__crawlJobs[0]
        );

        if (job) {
          // Simulate initial job creation
          setTimeout(() => {
            const event = new CustomEvent('crawl-job-created', {
              detail: {
                jobId: job.jobId,
                title: job.title,
                totalImages: job.totalImages,
                status: 'pending'
              }
            });
            window.dispatchEvent(event);
          }, 10);
        }

        return { jobId: job ? job.jobId : 'unknown' };
      };

      (window as any).electronAPI.onCrawlProgress = (callback: Function) => {
        (window as any).__progressListeners.push(callback);
        return () => {
          const index = (window as any).__progressListeners.indexOf(callback);
          if (index > -1) {
            (window as any).__progressListeners.splice(index, 1);
          }
        };
      };
    }, jobs);
  }

  async getStartCalls(): Promise<string[]> {
    const calls = await this.page.evaluate(() => (window as any).__startCalls || []);
    return calls;
  }

  async emitProgress(event: ProgressEvent): Promise<void> {
    await this.page.evaluate((progressEvent) => {
      const listeners = (window as any).__progressListeners || [];
      listeners.forEach((callback: Function) => {
        callback(null, progressEvent);
      });

      // Also dispatch a custom event for the UI
      const customEvent = new CustomEvent('crawl-progress', { detail: progressEvent });
      window.dispatchEvent(customEvent);
    }, event);

    // Wait a bit for the UI to update
    await this.page.waitForTimeout(50);
  }

  async restoreElectronApi(): Promise<void> {
    await this.page.evaluate(() => {
      delete (window as any).__startCalls;
      delete (window as any).__crawlJobs;
      delete (window as any).__progressListeners;
      delete (window as any).__fetchCallCount;
      delete (window as any).__mockHtml;
      delete (window as any).__mockFS;
      delete (window as any).__downloadSettings;

      // Note: We don't restore fetchUrl as Object.defineProperty makes it harder to restore
      // The test framework will reload the page between tests anyway
    });
  }

  async setupFileSystemMock(settings?: DownloadSettings): Promise<void> {
    const defaultSettings = {
      defaultDownloadPath: 'C:\\Users\\TestUser\\Downloads'
    };

    await this.page.evaluate((config) => {
      // Initialize mock filesystem
      (window as any).__mockFS = {
        folders: new Set<string>(),
        files: new Map<string, any>(),
        existingFolders: new Set<string>()
      };

      // Set download settings
      (window as any).__downloadSettings = config;

      // Mock the settings API
      if (!window.electronAPI) {
        (window as any).electronAPI = {};
      }

      window.electronAPI.getSettings = async () => {
        return (window as any).__downloadSettings;
      };

      // Helper function to sanitize folder names
      (window as any).__sanitizeFolderName = (title: string): string => {
        if (!title || title.trim() === '') {
          return `gallery_${Date.now()}`;
        }

        // Trim first to handle leading/trailing spaces
        let safe = title.trim();
        // Windows forbidden characters
        safe = safe.replace(/[<>:"/\\|?*]/g, '_');
        // Replace consecutive spaces/underscores with single underscore
        safe = safe.replace(/[\s_]+/g, '_');
        // Remove leading/trailing dots
        safe = safe.replace(/^\.+|\.+$/g, '');
        // Remove leading/trailing underscores (from replaced spaces)
        safe = safe.replace(/^_+|_+$/g, '');
        // Limit length
        if (safe.length > 200) {
          safe = safe.substring(0, 200);
        }

        return safe || `gallery_${Date.now()}`;
      };

      // Override startCrawl to simulate folder creation
      const originalStartCrawl = window.electronAPI.startCrawl;
      window.electronAPI.startCrawl = async (url: string, data: any) => {
        const fs = (window as any).__mockFS;
        const settings = (window as any).__downloadSettings;
        const sanitize = (window as any).__sanitizeFolderName;

        // Sanitize folder name
        const folderName = sanitize(data.title || 'Untitled');
        const folderPath = `${settings.defaultDownloadPath}\\${folderName}`;

        // Check if folder exists
        if (!fs.existingFolders.has(folderPath)) {
          // Create new folder
          fs.folders.add(folderPath);
        }

        // Simulate downloading files
        const imageUrls = data.imageUrls || [];
        for (let i = 0; i < imageUrls.length; i++) {
          const fileName = `${String(i + 1).padStart(3, '0')}.jpg`;
          const filePath = `${folderPath}\\${fileName}`;
          fs.files.set(filePath, { path: filePath, content: `mock-image-${i + 1}` });
        }

        // Call original if it exists
        if (originalStartCrawl && typeof originalStartCrawl === 'function') {
          return await originalStartCrawl(url, data);
        }

        // Or add to __startCalls if available
        if ((window as any).__startCalls) {
          (window as any).__startCalls.push(url);
        }

        return { jobId: `job-${Date.now()}` };
      };
    }, settings || defaultSettings);
  }

  async mockExistingFolder(folderPath: string): Promise<void> {
    await this.page.evaluate((path) => {
      const fs = (window as any).__mockFS;
      if (fs) {
        fs.existingFolders.add(path);
        fs.folders.add(path);
      }
    }, folderPath);
  }

  async getCreatedFolders(): Promise<string[]> {
    return await this.page.evaluate(() => {
      const fs = (window as any).__mockFS;
      return fs ? Array.from(fs.folders) : [];
    });
  }

  async getDownloadedFiles(): Promise<Array<{ path: string; content?: string }>> {
    return await this.page.evaluate(() => {
      const fs = (window as any).__mockFS;
      if (!fs) return [];

      const files: Array<{ path: string; content?: string }> = [];
      fs.files.forEach((value: any) => {
        files.push(value);
      });
      return files;
    });
  }

  async getSanitizedFolderName(title: string): Promise<string> {
    return await this.page.evaluate((t) => {
      const sanitize = (window as any).__sanitizeFolderName;
      return sanitize ? sanitize(t) : t;
    }, title);
  }
}