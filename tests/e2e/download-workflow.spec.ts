import { test, expect } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';
import { DownloadPage } from '../pages/DownloadPage';
import { galleryHtml, makeTempDir, removeDir } from '../helpers/fixtures';

// Image URLs here are never fetched: 'fetch-url' and 'start-crawling' are stubbed in main.
const IMAGE_BASE = 'https://cdn.test/g/';
const VALID_TITLE = '[Author] Sample Title (Series)';
const VALID_HTML = galleryHtml({ title: VALID_TITLE, pageCount: 3, imageBase: IMAGE_BASE });
const MISSING_SECTIONS_HTML = galleryHtml({ title: null, pageCount: null, imageBase: IMAGE_BASE, thumbnails: 0 });

test.describe('Download workflow (docs/1-5-1, 1-5-2)', () => {
  let electronApp: ElectronAppHelper;
  let downloadPage: DownloadPage;
  let downloadRoot: string;

  test.beforeEach(async () => {
    downloadRoot = await makeTempDir('iv-dl');
    electronApp = new ElectronAppHelper();
    await electronApp.launch({ downloadPath: downloadRoot });
    downloadPage = new DownloadPage(electronApp.getWindow(), electronApp.getApp());
    await downloadPage.openDownloadPanel();
  });

  test.afterEach(async () => {
    await electronApp.close();
    await removeDir(downloadRoot);
  });

  test.describe('DownloadDialog', () => {
    test('shows scraped metadata and enables start for a valid gallery', async () => {
      await downloadPage.stubFetchWithHtml(VALID_HTML);
      await downloadPage.openCreateJobDialog();
      await downloadPage.fillUrl('https://example.com/gallery/123');
      await downloadPage.triggerScrape();
      await downloadPage.waitForScrapeResult();

      expect(await downloadPage.getScrapeTitle()).toBe(VALID_TITLE);
      expect(await downloadPage.getScrapePageCount()).toContain('3');
      expect(await downloadPage.getScrapeImageCount()).toBe(3);
      expect(await downloadPage.isStartEnabled()).toBe(true);
      expect(await downloadPage.getFetchCallCount()).toBe(1);
    });

    test('blocks scraping when URL is empty', async () => {
      await downloadPage.stubFetchWithHtml(VALID_HTML);
      await downloadPage.openCreateJobDialog();
      await downloadPage.fillUrl('');
      await downloadPage.triggerScrape();
      await downloadPage.waitForError();

      expect((await downloadPage.getErrorMessage()).toLowerCase()).toContain('required');
      expect(await downloadPage.isStartEnabled()).toBe(false);
      expect(await downloadPage.getFetchCallCount()).toBe(0);
    });

    test('blocks scraping when URL is not http/https', async () => {
      await downloadPage.stubFetchWithHtml(VALID_HTML);
      await downloadPage.openCreateJobDialog();
      await downloadPage.fillUrl('ftp://invalid.example');
      await downloadPage.triggerScrape();
      await downloadPage.waitForError();

      expect((await downloadPage.getErrorMessage()).toLowerCase()).toContain('invalid');
      expect(await downloadPage.isStartEnabled()).toBe(false);
      expect(await downloadPage.getFetchCallCount()).toBe(0);
    });

    test('surfaces network errors and keeps start disabled', async () => {
      await downloadPage.stubFetchWithError('Network unreachable');
      await downloadPage.openCreateJobDialog();
      await downloadPage.fillUrl('https://example.com/gallery/500');
      await downloadPage.triggerScrape();
      await downloadPage.waitForError();

      expect(await downloadPage.getErrorMessage()).toContain('Network unreachable');
      expect(await downloadPage.isStartEnabled()).toBe(false);
      expect(await downloadPage.getFetchCallCount()).toBe(1);
    });

    test('handles missing HTML sections gracefully', async () => {
      await downloadPage.stubFetchWithHtml(MISSING_SECTIONS_HTML);
      await downloadPage.openCreateJobDialog();
      await downloadPage.fillUrl('https://example.com/gallery/missing');
      await downloadPage.triggerScrape();
      await downloadPage.waitForScrapeResult();

      expect(await downloadPage.getScrapeTitle()).toBe('');
      expect(await downloadPage.getScrapeImageCount()).toBe(0);
      expect(await downloadPage.isStartEnabled()).toBe(false);
      expect((await downloadPage.getErrorMessage()).toLowerCase()).toContain('missing');
    });

    test('cancel closes dialog and resets state', async () => {
      await downloadPage.stubFetchWithHtml(VALID_HTML);
      await downloadPage.openCreateJobDialog();
      await downloadPage.fillUrl('https://example.com/gallery/reset');
      await downloadPage.triggerScrape();
      await downloadPage.waitForScrapeResult();
      expect(await downloadPage.isStartEnabled()).toBe(true);

      await downloadPage.triggerCancel();
      await downloadPage.waitForDialogToClose();

      await downloadPage.openCreateJobDialog();
      expect(await downloadPage.getUrlValue()).toBe('');
      expect(await downloadPage.isStartEnabled()).toBe(false);
      expect(await downloadPage.hasScrapeResult()).toBe(false);
    });
  });

  test.describe('DownloadPanel crawl jobs', () => {
    test('creates a crawl job card after starting download', async () => {
      const jobId = 'job-1';
      await downloadPage.stubFetchWithHtml(VALID_HTML);
      await downloadPage.stubStartCrawl(jobId);

      await downloadPage.openCreateJobDialog();
      await downloadPage.fillUrl('https://example.com/gallery/start');
      await downloadPage.triggerScrape();
      await downloadPage.waitForScrapeResult();
      await downloadPage.triggerStart();
      await downloadPage.waitForDialogToClose();
      await downloadPage.waitForJobCard(jobId);

      const startCalls = await downloadPage.getStartCalls();
      expect(startCalls).toHaveLength(1);
      expect(startCalls[0].url).toBe('https://example.com/gallery/start');
      expect(startCalls[0].title).toBe(VALID_TITLE);
      expect(startCalls[0].imageUrls).toEqual([`${IMAGE_BASE}1.jpg`, `${IMAGE_BASE}2.jpg`, `${IMAGE_BASE}3.jpg`]);

      const card = downloadPage.getJobCard(jobId);
      await expect(card.title()).toHaveText(VALID_TITLE);
      await expect(card.progressText()).toContainText('0/3');
      await expect(card.status()).toHaveText(/pending|queued/i);
    });

    test('Create Job button coexists with Clear Completed in panel header', async () => {
      const page = electronApp.getWindow();

      await expect(page.locator('[data-testid="download-panel-create-job"]')).toBeVisible();
      await expect(page.locator('[data-testid="download-panel-clear-completed"]')).toBeVisible();

      await downloadPage.openCreateJobDialog();
      await downloadPage.triggerCancel();
      await downloadPage.waitForDialogToClose();
    });
  });
});
