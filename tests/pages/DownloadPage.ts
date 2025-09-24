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
      const originalFetch = window.fetch;
      (window as any).__originalFetch = originalFetch;
      (window as any).__fetchCallCount = 0;

      window.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
        (window as any).__fetchCallCount++;

        return new Response(htmlContent, {
          status: 200,
          headers: { 'Content-Type': 'text/html' }
        });
      };
    }, html);
  }

  async stubFetchWithError(errorMessage: string): Promise<void> {
    this.fetchCallCount = 0;

    await this.page.evaluate((message) => {
      const originalFetch = window.fetch;
      (window as any).__originalFetch = originalFetch;
      (window as any).__fetchCallCount = 0;

      window.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
        (window as any).__fetchCallCount++;
        throw new Error(message);
      };
    }, errorMessage);
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

  async restoreFetch(): Promise<void> {
    await this.page.evaluate(() => {
      if ((window as any).__originalFetch) {
        window.fetch = (window as any).__originalFetch;
        delete (window as any).__originalFetch;
        delete (window as any).__fetchCallCount;
      }
    });
  }

  async restoreElectronApi(): Promise<void> {
    await this.page.evaluate(() => {
      delete (window as any).__startCalls;
      delete (window as any).__crawlJobs;
      delete (window as any).__progressListeners;

      // Note: We don't delete electronAPI itself as it might be needed by the app
    });
  }
}