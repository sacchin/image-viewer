import { test, expect } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';
import { DownloadPage, CrawlJobStub } from '../pages/DownloadPage';

const VALID_HTML = `
<html>
  <body>
    <div class="info">
      <h2>[Author] Sample Title (Series)</h2>
    </div>
    <div class="gallery">
      <div class="preview_thumb"><img data-src="https://cdn.test/image-1.jpg" /></div>
      <div class="preview_thumb"><img data-src="https://cdn.test/image-2.jpg" /></div>
      <div class="preview_thumb"><img data-src="https://cdn.test/image-3.jpg" /></div>
    </div>
  </body>
</html>`;

const MISSING_SECTIONS_HTML = `
<html>
  <body>
    <div class="gallery"></div>
  </body>
</html>`;

test.describe('Download workflow (docs/1-5-1, 1-5-2)', () => {
  let electronApp: ElectronAppHelper;
  let downloadPage: DownloadPage | undefined;

  test.beforeEach(async () => {
    electronApp = new ElectronAppHelper();
    await electronApp.launch();
    const window = electronApp.getWindow();
    downloadPage = new DownloadPage(window);

    // Wait for electronAPI to be available
    await window.waitForFunction(() => window.electronAPI !== undefined, { timeout: 10000 });

    await downloadPage.openDownloadPanel();
  });

  test.afterEach(async () => {
    try {
      if (downloadPage) {
        await downloadPage.restoreElectronApi();
      }
    } catch {
      // Window might already be closed; ignore cleanup failures.
    } finally {
      await electronApp.close();
    }
  });

  test.describe('DownloadDialog', () => {
    // test('shows scraped metadata and enables start for a valid gallery', async () => {
    //   // Set up the mock before opening dialog
    //   await downloadPage!.stubFetchWithHtml(VALID_HTML);
    //   await downloadPage!.openCreateJobDialog();
    //   await downloadPage!.fillUrl('https://example.com/gallery/123');
    //   await downloadPage!.triggerScrape();
    //   await downloadPage!.waitForScrapeResult();

    //   expect(await downloadPage!.getScrapeTitle()).toBe('[Author] Sample Title (Series)');
    //   expect(await downloadPage!.getScrapePageCount()).toContain('3');
    //   expect(await downloadPage!.getScrapeImageCount()).toBe(3);
    //   expect(await downloadPage!.isStartEnabled()).toBe(true);
    //   expect(await downloadPage!.getFetchCallCount()).toBe(1);
    // });

    test('blocks scraping when URL is empty', async () => {
      await downloadPage!.stubFetchWithHtml(VALID_HTML);
      await downloadPage!.openCreateJobDialog();
      await downloadPage!.fillUrl('');
      await downloadPage!.triggerScrape();
      await downloadPage!.waitForError();

      const errorMessage = await downloadPage!.getErrorMessage();
      expect(errorMessage.toLowerCase()).toContain('required');
      expect(await downloadPage!.isStartEnabled()).toBe(false);
      expect(await downloadPage!.getFetchCallCount()).toBe(0);
    });

    test('blocks scraping when URL is not http/https', async () => {
      await downloadPage!.stubFetchWithHtml(VALID_HTML);
      await downloadPage!.openCreateJobDialog();
      await downloadPage!.fillUrl('ftp://invalid.example');
      await downloadPage!.triggerScrape();
      await downloadPage!.waitForError();

      const errorMessage = await downloadPage!.getErrorMessage();
      expect(errorMessage.toLowerCase()).toContain('invalid');
      expect(await downloadPage!.isStartEnabled()).toBe(false);
      expect(await downloadPage!.getFetchCallCount()).toBe(0);
    });

    // test('surfaces network errors and keeps start disabled', async () => {
    //   await downloadPage!.stubFetchWithError('Network unreachable');
    //   await downloadPage!.openCreateJobDialog();
    //   await downloadPage!.fillUrl('https://example.com/gallery/500');
    //   await downloadPage!.triggerScrape();
    //   await downloadPage!.waitForError();

    //   const errorMessage = await downloadPage!.getErrorMessage();
    //   expect(errorMessage).toContain('Network unreachable');
    //   expect(await downloadPage!.isStartEnabled()).toBe(false);
    //   expect(await downloadPage!.getFetchCallCount()).toBe(1);
    // });

  //   test('handles missing HTML sections gracefully', async () => {
  //     await downloadPage!.stubFetchWithHtml(MISSING_SECTIONS_HTML);
  //     await downloadPage!.openCreateJobDialog();
  //     await downloadPage!.fillUrl('https://example.com/gallery/missing');
  //     await downloadPage!.triggerScrape();
  //     await downloadPage!.waitForScrapeResult();

  //     expect(await downloadPage!.getScrapeTitle()).toBe('');
  //     expect(await downloadPage!.getScrapeImageCount()).toBe(0);
  //     expect(await downloadPage!.isStartEnabled()).toBe(false);

  //     const message = (await downloadPage!.getErrorMessage()).toLowerCase();
  //     expect(message).toContain('missing');
  //   });

  //   test('cancel closes dialog and resets state', async () => {
  //     await downloadPage!.stubFetchWithHtml(VALID_HTML);
  //     await downloadPage!.openCreateJobDialog();
  //     await downloadPage!.fillUrl('https://example.com/gallery/reset');
  //     await downloadPage!.triggerScrape();
  //     await downloadPage!.waitForScrapeResult();
  //     expect(await downloadPage!.isStartEnabled()).toBe(true);

  //     await downloadPage!.triggerCancel();
  //     await downloadPage!.waitForDialogToClose();

  //     await downloadPage!.openCreateJobDialog();
  //     expect(await downloadPage!.getUrlValue()).toBe('');
  //     expect(await downloadPage!.isStartEnabled()).toBe(false);
  //     expect(await downloadPage!.hasScrapeResult()).toBe(false);
  //   });
  // });

  test.describe('DownloadPanel crawl jobs', () => {
    const crawlJob = (overrides: Partial<CrawlJobStub> = {}): CrawlJobStub => ({
      jobId: overrides.jobId ?? `job-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
      title: overrides.title ?? 'Sample crawl job',
      totalImages: overrides.totalImages ?? 3,
      imageUrls: overrides.imageUrls ?? [
        'https://cdn.test/image-1.jpg',
        'https://cdn.test/image-2.jpg',
        'https://cdn.test/image-3.jpg'
      ]
    });

    // test('creates a crawl job card after starting download', async () => {
    //   const job = crawlJob({ jobId: 'job-1', totalImages: 3 });

    //   await downloadPage!.stubFetchWithHtml(VALID_HTML);
    //   await downloadPage!.setupCrawlStubs(job);
    //   await downloadPage!.openCreateJobDialog();
    //   await downloadPage!.fillUrl('https://example.com/gallery/start');
    //   await downloadPage!.triggerScrape();
    //   await downloadPage!.waitForScrapeResult();
    //   await downloadPage!.triggerStart();
    //   await downloadPage!.waitForDialogToClose();
    //   await downloadPage!.waitForJobCard(job.jobId);

    //   const startCalls = await downloadPage!.getStartCalls();
    //   expect(startCalls).toContain('https://example.com/gallery/start');

    //   const card = await downloadPage!.getJobCard(job.jobId);
    //   expect((await card.title().textContent()) ?? '').toContain(job.title);
    //   expect((await card.progressText().textContent()) ?? '').toContain('0');
    //   expect((await card.status().textContent()) ?? '').toMatch(/pending|queued/i);
    // });

    // test('updates progress and marks completion', async () => {
    //   const job = crawlJob({ jobId: 'job-progress', totalImages: 5 });

    //   await downloadPage!.stubFetchWithHtml(VALID_HTML);
    //   await downloadPage!.setupCrawlStubs(job);
    //   await downloadPage!.openCreateJobDialog();
    //   await downloadPage!.fillUrl('https://example.com/gallery/progress');
    //   await downloadPage!.triggerScrape();
    //   await downloadPage!.waitForScrapeResult();
    //   await downloadPage!.triggerStart();
    //   await downloadPage!.waitForDialogToClose();
    //   await downloadPage!.waitForJobCard(job.jobId);

    //   await downloadPage!.emitProgress({
    //     jobId: job.jobId,
    //     completed: 2,
    //     total: 5,
    //     status: 'downloading'
    //   });

    //   const card = await downloadPage!.getJobCard(job.jobId);
    //   expect((await card.progressText().textContent()) ?? '').toContain('2');
    //   const progressWidth = await card.progressBar().evaluate((el) => (el as HTMLElement).style.width);
    //   expect(progressWidth).toContain('40');

    //   await downloadPage!.emitProgress({
    //     jobId: job.jobId,
    //     completed: 5,
    //     total: 5,
    //     status: 'completed'
    //   });

    //   expect((await card.status().textContent()) ?? '').toMatch(/complete/i);
    //   expect((await card.progressText().textContent()) ?? '').toContain('5');
    // });

    // test('marks job as error when crawler fails', async () => {
    //   const job = crawlJob({ jobId: 'job-error' });

    //   await downloadPage!.stubFetchWithHtml(VALID_HTML);
    //   await downloadPage!.setupCrawlStubs(job);
    //   await downloadPage!.openCreateJobDialog();
    //   await downloadPage!.fillUrl('https://example.com/gallery/error');
    //   await downloadPage!.triggerScrape();
    //   await downloadPage!.waitForScrapeResult();
    //   await downloadPage!.triggerStart();
    //   await downloadPage!.waitForDialogToClose();
    //   await downloadPage!.waitForJobCard(job.jobId);

    //   await downloadPage!.emitProgress({
    //     jobId: job.jobId,
    //     completed: 1,
    //     total: job.totalImages,
    //     status: 'error',
    //     message: 'Disk full'
    //   });

    //   const card = await downloadPage!.getJobCard(job.jobId);
    //   const statusText = ((await card.status().textContent()) ?? '').toLowerCase();
    //   expect(statusText).toContain('error');
    //   expect(statusText).toContain('disk full');
    // });

    // test('handles multiple jobs independently', async () => {
    //   const jobA = crawlJob({ jobId: 'job-a', title: 'First Job', totalImages: 4 });
    //   const jobB = crawlJob({ jobId: 'job-b', title: 'Second Job', totalImages: 2 });

    //   // Set up mocks before opening dialog
    //   await downloadPage!.stubFetchWithHtml(VALID_HTML);
    //   await downloadPage!.setupCrawlStubs(jobA, jobB);

    //   // Create first job
    //   await downloadPage!.openCreateJobDialog();
    //   await downloadPage!.fillUrl('https://example.com/gallery/A');
    //   await downloadPage!.triggerScrape();
    //   await downloadPage!.waitForScrapeResult();
    //   await downloadPage!.triggerStart();
    //   await downloadPage!.waitForDialogToClose();
    //   await downloadPage!.waitForJobCard(jobA.jobId);

    //   // Create second job
    //   await downloadPage!.openCreateJobDialog();
    //   await downloadPage!.fillUrl('https://example.com/gallery/B');
    //   await downloadPage!.triggerScrape();
    //   await downloadPage!.waitForScrapeResult();
    //   await downloadPage!.triggerStart();
    //   await downloadPage!.waitForDialogToClose();
    //   await downloadPage!.waitForJobCard(jobB.jobId);

    //   await downloadPage!.emitProgress({
    //     jobId: jobA.jobId,
    //     completed: 3,
    //     total: jobA.totalImages,
    //     status: 'downloading'
    //   });
    //   await downloadPage!.emitProgress({
    //     jobId: jobB.jobId,
    //     completed: 2,
    //     total: jobB.totalImages,
    //     status: 'completed'
    //   });

    //   const cardA = await downloadPage!.getJobCard(jobA.jobId);
    //   const cardB = await downloadPage!.getJobCard(jobB.jobId);

    //   expect((await cardA.progressText().textContent()) ?? '').toContain('3');
    //   expect((await cardA.status().textContent()) ?? '').toMatch(/downloading/i);

    //   expect((await cardB.progressText().textContent()) ?? '').toContain('2');
    //   expect((await cardB.status().textContent()) ?? '').toMatch(/complete/i);
    // });

    test('Create Job button coexists with Clear Completed in panel header', async () => {
      const window = electronApp.getWindow();

      await expect(window.locator('[data-testid="download-panel-create-job"]')).toBeVisible();
      await expect(window.locator('[data-testid="download-panel-clear-completed"]')).toBeVisible();

      await downloadPage!.openCreateJobDialog();
      await downloadPage!.triggerCancel();
      await downloadPage!.waitForDialogToClose();
    });
  });
});