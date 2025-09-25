import { test, expect } from '@playwright/test';
import { ElectronAppHelper } from '../helpers/electron-app';
import { DownloadPage } from '../pages/DownloadPage';

const VALID_HTML_WITH_TITLE = (title: string) => `
<html>
  <body>
    <div class="info">
      <h2>${title}</h2>
    </div>
    <div class="gallery">
      <div class="preview_thumb"><img data-src="https://cdn.test/image-1.jpg" /></div>
      <div class="preview_thumb"><img data-src="https://cdn.test/image-2.jpg" /></div>
      <div class="preview_thumb"><img data-src="https://cdn.test/image-3.jpg" /></div>
    </div>
  </body>
</html>`;

const HTML_WITHOUT_TITLE = `
<html>
  <body>
    <div class="gallery">
      <div class="preview_thumb"><img data-src="https://cdn.test/image-1.jpg" /></div>
      <div class="preview_thumb"><img data-src="https://cdn.test/image-2.jpg" /></div>
    </div>
  </body>
</html>`;

test.describe('Download folder creation based on title (doc/1-6)', () => {
  let electronApp: ElectronAppHelper;
  let downloadPage: DownloadPage | undefined;
  const testDownloadPath = 'C:\\Users\\TestUser\\Downloads';

  test.beforeEach(async () => {
    electronApp = new ElectronAppHelper();
    await electronApp.launch();
    const window = electronApp.getWindow();
    downloadPage = new DownloadPage(window);

    // Wait for electronAPI to be available
    await window.waitForFunction(() => window.electronAPI !== undefined, { timeout: 10000 });

    // Setup filesystem mock
    await downloadPage.setupFileSystemMock({
      defaultDownloadPath: testDownloadPath
    });

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

  test('creates folder with sanitized title name', async () => {
    const title = '[Author] Sample Gallery Title';
    const expectedFolderName = 'Author_Sample_Gallery_Title';

    // Setup mocks before opening dialog
    await downloadPage!.stubFetchWithHtml(VALID_HTML_WITH_TITLE(title));
    await downloadPage!.setupCrawlStubs();
    await downloadPage!.openCreateJobDialog();
    await downloadPage!.fillUrl('https://example.com/gallery/normal-title');
    await downloadPage!.triggerScrape();
    await downloadPage!.waitForScrapeResult();

    expect(await downloadPage!.getScrapeTitle()).toBe(title);

    await downloadPage!.triggerStart();
    await downloadPage!.waitForDialogToClose();

    const createdFolders = await downloadPage!.getCreatedFolders();
    const expectedPath = `${testDownloadPath}\\${expectedFolderName}`;

    expect(createdFolders).toContain(expectedPath);

    const downloadedFiles = await downloadPage!.getDownloadedFiles();
    expect(downloadedFiles.length).toBe(3);
    expect(downloadedFiles[0].path).toBe(`${expectedPath}\\001.jpg`);
    expect(downloadedFiles[1].path).toBe(`${expectedPath}\\002.jpg`);
    expect(downloadedFiles[2].path).toBe(`${expectedPath}\\003.jpg`);
  });

  test('sanitizes special characters in title', async () => {
    const testCases = [
      {
        title: 'Title: with/special*chars?',
        expected: 'Title_with_special_chars_'
      },
      {
        title: 'Title<>with|pipe"and*quote',
        expected: 'Title_with_pipe_and_quote'
      },
      {
        title: 'Title\\with\\backslash',
        expected: 'Title_with_backslash'
      }
    ];

    for (const testCase of testCases) {
      await downloadPage!.stubFetchWithHtml(VALID_HTML_WITH_TITLE(testCase.title));
      await downloadPage!.setupCrawlStubs();
      await downloadPage!.openCreateJobDialog();
      await downloadPage!.fillUrl(`https://example.com/gallery/${testCase.title}`);
      await downloadPage!.triggerScrape();
      await downloadPage!.waitForScrapeResult();

      await downloadPage!.triggerStart();
      await downloadPage!.waitForDialogToClose();

      const createdFolders = await downloadPage!.getCreatedFolders();
      const expectedPath = `${testDownloadPath}\\${testCase.expected}`;

      expect(createdFolders).toContain(expectedPath);
    }
  });

  test('handles empty or missing title with fallback name', async () => {
    await downloadPage!.stubFetchWithHtml(HTML_WITHOUT_TITLE);
    await downloadPage!.setupCrawlStubs();
    await downloadPage!.openCreateJobDialog();
    await downloadPage!.fillUrl('https://example.com/gallery/no-title');
    await downloadPage!.triggerScrape();
    await downloadPage!.waitForScrapeResult();

    // Title should be empty
    expect(await downloadPage!.getScrapeTitle()).toBe('');

    await downloadPage!.triggerStart();
    await downloadPage!.waitForDialogToClose();

    const createdFolders = await downloadPage!.getCreatedFolders();

    // Should create folder with fallback name pattern
    const folderPath = createdFolders.find(f => f.startsWith(`${testDownloadPath}\\gallery_`));
    expect(folderPath).toBeDefined();

    const downloadedFiles = await downloadPage!.getDownloadedFiles();
    expect(downloadedFiles.length).toBe(2);
  });

  test('truncates long title to 200 characters', async () => {
    const longTitle = 'A'.repeat(250);
    const expectedFolderName = 'A'.repeat(200);

    await downloadPage!.stubFetchWithHtml(VALID_HTML_WITH_TITLE(longTitle));
    await downloadPage!.setupCrawlStubs();
    await downloadPage!.openCreateJobDialog();
    await downloadPage!.fillUrl('https://example.com/gallery/long-title');
    await downloadPage!.triggerScrape();
    await downloadPage!.waitForScrapeResult();

    await downloadPage!.triggerStart();
    await downloadPage!.waitForDialogToClose();

    const createdFolders = await downloadPage!.getCreatedFolders();
    const expectedPath = `${testDownloadPath}\\${expectedFolderName}`;

    expect(createdFolders).toContain(expectedPath);
  });

  test('uses existing folder when same title is downloaded again', async () => {
    const title = '[Author] Duplicate Gallery';
    const sanitizedName = 'Author_Duplicate_Gallery';
    const existingFolderPath = `${testDownloadPath}\\${sanitizedName}`;

    // Mock existing folder
    await downloadPage!.mockExistingFolder(existingFolderPath);

    await downloadPage!.stubFetchWithHtml(VALID_HTML_WITH_TITLE(title));
    await downloadPage!.setupCrawlStubs();
    await downloadPage!.openCreateJobDialog();
    await downloadPage!.fillUrl('https://example.com/gallery/duplicate');
    await downloadPage!.triggerScrape();
    await downloadPage!.waitForScrapeResult();

    await downloadPage!.triggerStart();
    await downloadPage!.waitForDialogToClose();

    const createdFolders = await downloadPage!.getCreatedFolders();

    // Should still contain the existing folder path
    expect(createdFolders).toContain(existingFolderPath);

    // Should not create a new folder with different name
    const duplicateFolders = createdFolders.filter(f =>
      f.startsWith(`${testDownloadPath}\\${sanitizedName}`)
    );
    expect(duplicateFolders.length).toBe(1);

    // Files should be downloaded to the existing folder
    const downloadedFiles = await downloadPage!.getDownloadedFiles();
    expect(downloadedFiles.every(f => f.path.startsWith(existingFolderPath))).toBe(true);
  });

  test('removes consecutive spaces and underscores from title', async () => {
    const title = 'Title    with___multiple     spaces___and___underscores';
    const expectedFolderName = 'Title_with_multiple_spaces_and_underscores';

    await downloadPage!.stubFetchWithHtml(VALID_HTML_WITH_TITLE(title));
    await downloadPage!.setupCrawlStubs();
    await downloadPage!.openCreateJobDialog();
    await downloadPage!.fillUrl('https://example.com/gallery/spaces');
    await downloadPage!.triggerScrape();
    await downloadPage!.waitForScrapeResult();

    await downloadPage!.triggerStart();
    await downloadPage!.waitForDialogToClose();

    const createdFolders = await downloadPage!.getCreatedFolders();
    const expectedPath = `${testDownloadPath}\\${expectedFolderName}`;

    expect(createdFolders).toContain(expectedPath);
  });

  test('removes leading and trailing dots from title', async () => {
    const title = '...Title with dots...';
    const expectedFolderName = 'Title_with_dots';

    await downloadPage!.stubFetchWithHtml(VALID_HTML_WITH_TITLE(title));
    await downloadPage!.setupCrawlStubs();
    await downloadPage!.openCreateJobDialog();
    await downloadPage!.fillUrl('https://example.com/gallery/dots');
    await downloadPage!.triggerScrape();
    await downloadPage!.waitForScrapeResult();

    await downloadPage!.triggerStart();
    await downloadPage!.waitForDialogToClose();

    const createdFolders = await downloadPage!.getCreatedFolders();
    const expectedPath = `${testDownloadPath}\\${expectedFolderName}`;

    expect(createdFolders).toContain(expectedPath);
  });

  test('verifies sanitization function directly', async () => {
    const testCases = [
      { input: 'Normal Title', expected: 'Normal_Title' },
      { input: 'Title: with/colon', expected: 'Title_with_colon' },
      { input: 'Title*with*asterisk', expected: 'Title_with_asterisk' },
      { input: 'Title?with?question', expected: 'Title_with_question' },
      { input: '"Title with quotes"', expected: 'Title_with_quotes' },
      { input: 'Title<with>brackets', expected: 'Title_with_brackets' },
      { input: 'Title|with|pipe', expected: 'Title_with_pipe' },
      { input: '   Spaces around   ', expected: 'Spaces_around' },
      { input: '', expected: expect.stringMatching(/^gallery_\d+$/) }
    ];

    for (const testCase of testCases) {
      const sanitized = await downloadPage!.getSanitizedFolderName(testCase.input);

      if (typeof testCase.expected === 'string') {
        expect(sanitized).toBe(testCase.expected);
      } else {
        expect(sanitized).toEqual(testCase.expected);
      }
    }
  });
});