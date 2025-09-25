import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { DOMParser as LinkedomDOMParser } from 'linkedom';

import { scrapeGalleryData, ScraperError } from '../scraper';

const ensureDomParser = () => {
  if (typeof (globalThis as { DOMParser?: typeof LinkedomDOMParser }).DOMParser === 'undefined') {
    (globalThis as { DOMParser: typeof LinkedomDOMParser }).DOMParser = LinkedomDOMParser;
  }
};

test('scrapeGalleryData extracts data from sample html', async () => {
  ensureDomParser();

  const samplePath = resolve(__dirname, '../../../..', 'test_data', 'sample.html');
  const html = readFileSync(samplePath, 'utf-8');

  const result = await scrapeGalleryData(html);

  assert.equal(result.title, '[著者名] タイトル (作品名)');
  assert.equal(result.pageCount, 9);
  assert.equal(result.imageUrls.length, 9);
  assert.ok(result.imageUrls[0].startsWith('https://'));
});

test('scrapeGalleryData handles missing title with warning', async () => {
  ensureDomParser();

  const html = [
    '<html>',
    '  <body>',
    '    <div class="gallery">',
    '      <div class="preview_thumb"><img data-src="https://example.com/1.jpg" /></div>',
    '    </div>',
    '  </body>',
    '</html>'
  ].join('\n');

  const result = await scrapeGalleryData(html);

  assert.equal(result.title, '');
  assert.equal(result.pageCount, 1);
  assert.equal(result.imageUrls.length, 1);
  assert.ok(result.warnings);
  assert.ok(result.warnings?.some(message => message.includes('title')));
});

test('scrapeGalleryData throws when HTML is empty', async () => {
  ensureDomParser();

  await assert.rejects(() => scrapeGalleryData('  '), (error: unknown) => {
    assert.ok(error instanceof ScraperError);
    assert.equal(error.message, 'HTML content is empty.');
    return true;
  });
});

test('scrapeGalleryData handles missing thumbnails with warning', async () => {
  ensureDomParser();

  const html = [
    '<html>',
    '  <body>',
    '    <div class="info">',
    '      <h2>Sample Work</h2>',
    '    </div>',
    '  </body>',
    '</html>'
  ].join('\n');

  const result = await scrapeGalleryData(html);

  assert.equal(result.pageCount, 0);
  assert.equal(result.imageUrls.length, 0);
  assert.ok(result.warnings);
  assert.ok(result.warnings?.some(message => message.includes('thumbnails')));
});
