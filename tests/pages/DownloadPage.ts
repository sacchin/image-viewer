import { ElectronApplication, Locator, Page } from '@playwright/test';

export interface StartCall {
  url: string;
  title: string;
  imageUrls: string[];
}

export interface JobCard {
  root(): Locator;
  title(): Locator;
  progressText(): Locator;
  progressBar(): Locator;
  status(): Locator;
}

/**
 * Page object for the Download panel.
 *
 * Network-facing behaviour is stubbed in the *main* process by replacing the
 * ipcMain handlers. Objects exposed through contextBridge are frozen, so
 * reassigning window.electronAPI.* from the renderer silently does nothing.
 */
export class DownloadPage {
  constructor(private page: Page, private app: ElectronApplication) {}

  // --- navigation -----------------------------------------------------------

  async openDownloadPanel(): Promise<void> {
    await this.page.click('[data-testid="side-menu-download"]');
    await this.page.waitForSelector('[data-testid="download-panel"]', { timeout: 5000 });
  }

  async openCreateJobDialog(): Promise<void> {
    await this.page.click('[data-testid="download-panel-create-job"]');
    await this.page.waitForSelector('[data-testid="download-dialog"]', { timeout: 5000 });
  }

  // --- dialog interaction ---------------------------------------------------

  async fillUrl(url: string): Promise<void> {
    await this.page.locator('[data-testid="download-dialog-url-input"]').fill(url);
  }

  async getUrlValue(): Promise<string> {
    return await this.page.locator('[data-testid="download-dialog-url-input"]').inputValue();
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

  async getScrapeTitle(): Promise<string> {
    return (await this.page.locator('[data-testid="download-dialog-scrape-title"]').textContent()) || '';
  }

  async getScrapePageCount(): Promise<string> {
    return (await this.page.locator('[data-testid="download-dialog-scrape-page-count"]').textContent()) || '';
  }

  async getScrapeImageCount(): Promise<number> {
    // DownloadDialog publishes the last scrape result for test inspection
    return await this.page.evaluate(() => {
      const result = (window as unknown as { __scrapeResult?: { imageUrls: string[] } }).__scrapeResult;
      return result ? result.imageUrls.length : 0;
    });
  }

  async getErrorMessage(): Promise<string> {
    return (await this.page.locator('[data-testid="download-dialog-error"]').textContent()) || '';
  }

  async isStartEnabled(): Promise<boolean> {
    return await this.page.locator('[data-testid="download-dialog-start-button"]').isEnabled();
  }

  async hasScrapeResult(): Promise<boolean> {
    return await this.page.locator('[data-testid="download-dialog-scrape-result"]').isVisible();
  }

  // --- job cards ------------------------------------------------------------

  jobCards(): Locator {
    return this.page.locator('.download-item-job[data-testid^="job-card-"]');
  }

  async waitForJobCard(jobId: string): Promise<void> {
    await this.page.waitForSelector(`[data-testid="job-card-${jobId}"]`, { timeout: 5000 });
  }

  getJobCard(jobId: string): JobCard {
    return this.cardFromLocator(this.page.locator(`[data-testid="job-card-${jobId}"]`));
  }

  /** The most recently created job card (cards are prepended to the list). */
  latestJobCard(): JobCard {
    return this.cardFromLocator(this.jobCards().first());
  }

  private cardFromLocator(card: Locator): JobCard {
    return {
      root: () => card,
      title: () => card.locator('[data-testid="job-card-title"]'),
      progressText: () => card.locator('[data-testid="job-card-progress-text"]'),
      progressBar: () => card.locator('[data-testid="job-card-progress-bar"]'),
      status: () => card.locator('[data-testid="job-card-status"]')
    };
  }

  // --- main-process stubs ---------------------------------------------------

  /** Make 'fetch-url' return the given HTML without touching the network. */
  async stubFetchWithHtml(html: string): Promise<void> {
    await this.app.evaluate(({ ipcMain }, htmlContent) => {
      const g = globalThis as unknown as { __fetchCalls: string[] };
      g.__fetchCalls = [];
      ipcMain.removeHandler('fetch-url');
      ipcMain.handle('fetch-url', async (_event, url: string) => {
        g.__fetchCalls.push(url);
        return { success: true, html: htmlContent };
      });
    }, html);
  }

  /** Make 'fetch-url' fail with the given message. */
  async stubFetchWithError(errorMessage: string): Promise<void> {
    await this.app.evaluate(({ ipcMain }, message) => {
      const g = globalThis as unknown as { __fetchCalls: string[] };
      g.__fetchCalls = [];
      ipcMain.removeHandler('fetch-url');
      ipcMain.handle('fetch-url', async (_event, url: string) => {
        g.__fetchCalls.push(url);
        return { success: false, error: message };
      });
    }, errorMessage);
  }

  async getFetchCallCount(): Promise<number> {
    return await this.app.evaluate(() => {
      const g = globalThis as unknown as { __fetchCalls?: string[] };
      return g.__fetchCalls?.length ?? 0;
    });
  }

  /**
   * Replace 'start-crawling' with a recorder that never downloads anything and
   * answers with the given job id.
   */
  async stubStartCrawl(jobId: string): Promise<void> {
    await this.app.evaluate(({ ipcMain }, id) => {
      const g = globalThis as unknown as { __startCalls: StartCall[] };
      g.__startCalls = [];
      ipcMain.removeHandler('start-crawling');
      ipcMain.handle('start-crawling', async (_event, url: string, data?: { title?: string; imageUrls?: string[] }) => {
        g.__startCalls.push({ url, title: data?.title ?? '', imageUrls: data?.imageUrls ?? [] });
        return { jobId: id, status: 'started', url };
      });
    }, jobId);
  }

  async getStartCalls(): Promise<StartCall[]> {
    return await this.app.evaluate(() => {
      const g = globalThis as unknown as { __startCalls?: StartCall[] };
      return g.__startCalls ?? [];
    });
  }
}
