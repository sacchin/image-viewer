import { test, expect } from '@playwright/test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { ElectronAppHelper } from '../helpers/electron-app';
import { DownloadPage } from '../pages/DownloadPage';
import { galleryHtml, ImageServer, makeTempDir, removeDir, startImageServer } from '../helpers/fixtures';

/**
 * End-to-end: the real crawler in the main process downloads from a local
 * HTTP server into the configured download root, so folder naming and file
 * numbering are verified on the actual file system (doc/adr/1-6.md).
 */
test.describe('Download folder creation based on title (doc/1-6)', () => {
  let electronApp: ElectronAppHelper;
  let downloadPage: DownloadPage;
  let downloadRoot: string;
  let server: ImageServer;

  test.beforeEach(async () => {
    server = await startImageServer();
    downloadRoot = await makeTempDir('iv-dl');
    electronApp = new ElectronAppHelper();
    await electronApp.launch({ downloadPath: downloadRoot });
    downloadPage = new DownloadPage(electronApp.getWindow(), electronApp.getApp());
    await downloadPage.openDownloadPanel();
  });

  test.afterEach(async () => {
    await electronApp.close();
    await server.close();
    await removeDir(downloadRoot);
  });

  /** Scrape a gallery with the given title, start the job and wait until it has finished. */
  async function downloadGallery(title: string | null, pageCount: number, urlSlug: string): Promise<void> {
    const html = galleryHtml({ title, pageCount, imageBase: `${server.baseUrl}/g/` });
    await downloadPage.stubFetchWithHtml(html);
    await downloadPage.openCreateJobDialog();
    await downloadPage.fillUrl(`https://example.com/gallery/${urlSlug}`);
    await downloadPage.triggerScrape();
    await downloadPage.waitForScrapeResult();
    await downloadPage.triggerStart();
    await downloadPage.waitForDialogToClose();

    const card = downloadPage.latestJobCard();
    await expect(card.root()).toBeVisible();
    await expect(card.status()).toHaveText(/completed|error/i, { timeout: 20000 });
  }

  async function listFolders(): Promise<string[]> {
    const entries = await fs.readdir(downloadRoot, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();
  }

  async function listFiles(folderName: string): Promise<string[]> {
    return (await fs.readdir(path.join(downloadRoot, folderName))).sort();
  }

  test('creates folder with sanitized title name and numbered files', async () => {
    await downloadGallery('[Author] Sample Gallery Title', 3, 'normal-title');

    expect(await listFolders()).toEqual(['[Author]_Sample_Gallery_Title']);
    expect(await listFiles('[Author]_Sample_Gallery_Title')).toEqual(['001.jpg', '002.jpg', '003.jpg']);
    await expect(downloadPage.latestJobCard().status()).toHaveText(/completed/i);
    await expect(downloadPage.latestJobCard().progressText()).toContainText('3/3');
    expect(server.requests).toEqual(['/g/1.jpg', '/g/2.jpg', '/g/3.jpg']);
  });

  test('sanitizes special characters in title', async () => {
    const testCases = [
      { title: 'Title: with/special*chars?', expected: 'Title_with_special_chars_' },
      { title: 'Title<>with|pipe"and*quote', expected: 'Title_with_pipe_and_quote' },
      { title: 'Title\\with\\backslash', expected: 'Title_with_backslash' }
    ];

    for (const [index, testCase] of testCases.entries()) {
      await downloadGallery(testCase.title, 1, `special-${index}`);
      expect(await listFolders()).toContain(testCase.expected);
      expect(await listFiles(testCase.expected)).toEqual(['001.jpg']);
    }
  });

  test('falls back to "Untitled" when the gallery has no title', async () => {
    await downloadGallery(null, 2, 'no-title');

    expect(await listFolders()).toEqual(['Untitled']);
    expect(await listFiles('Untitled')).toEqual(['001.jpg', '002.jpg']);
  });

  test('truncates long title to 200 characters', async () => {
    await downloadGallery('A'.repeat(250), 1, 'long-title');

    expect(await listFolders()).toEqual(['A'.repeat(200)]);
  });

  test('uses existing folder when same title is downloaded again', async () => {
    const folderName = '[Author]_Duplicate_Gallery';
    const existing = path.join(downloadRoot, folderName);
    await fs.mkdir(existing);
    await fs.writeFile(path.join(existing, '001.jpg'), 'pre-existing');

    await downloadGallery('[Author] Duplicate Gallery', 2, 'duplicate');

    // No second folder, and numbering continues after the existing file
    expect(await listFolders()).toEqual([folderName]);
    expect(await listFiles(folderName)).toEqual(['001.jpg', '002.jpg', '003.jpg']);
    expect(await fs.readFile(path.join(existing, '001.jpg'), 'utf8')).toBe('pre-existing');
  });

  test('removes consecutive spaces and underscores from title', async () => {
    await downloadGallery('Title    with___multiple     spaces___and___underscores', 1, 'spaces');

    expect(await listFolders()).toEqual(['Title_with_multiple_spaces_and_underscores']);
  });

  test('removes leading and trailing dots from title', async () => {
    await downloadGallery('...Title with dots...', 1, 'dots');

    expect(await listFolders()).toEqual(['Title_with_dots']);
  });
});
