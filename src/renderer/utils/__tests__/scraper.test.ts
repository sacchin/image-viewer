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

  assert.equal(result.title, '[星茶] なんだかんだハメさせてくれるチャイナありす (アイドルマスターシンデレラガールズ)');
  assert.equal(result.pageCount, 9);
  assert.equal(result.imageUrls.length, 9);
  assert.ok(result.imageUrls[0].startsWith('https://'));
});

test('scrapeGalleryData handles missing title with warning', async () => {
  ensureDomParser();

  const html = [
    '<html>',
    '  <body>',
    '    <div class="pages">',
    '      <h3>Pages: 2</h3>',
    '    </div>',
    '    <div class="gallery">',
    '      <div class="preview_thumb"><img data-src="https://example.com/001/1t.jpg" /></div>',
    '      <div class="preview_thumb"><img data-src="https://example.com/001/2t.jpg" /></div>',
    '    </div>',
    '  </body>',
    '</html>'
  ].join('\n');

  const result = await scrapeGalleryData(html);

  assert.equal(result.title, '');
  assert.equal(result.pageCount, 2);
  assert.equal(result.imageUrls.length, 2);
  assert.deepEqual(result.imageUrls, [
    'https://example.com/001/1.jpg',
    'https://example.com/001/2.jpg'
  ]);
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
    '    <div class="pages">',
    '      <h3>Pages: 5</h3>',
    '    </div>',
    '  </body>',
    '</html>'
  ].join('\n');

  const result = await scrapeGalleryData(html);

  assert.equal(result.pageCount, 5);
  assert.equal(result.imageUrls.length, 0);
  assert.ok(result.warnings);
  assert.ok(result.warnings?.some(message => message.includes('thumbnails')));
});

test('scrapeGalleryData extracts pageCount from pages section', async () => {
  ensureDomParser();

  const html = [
    '<html>',
    '  <body>',
    '    <div class="info">',
    '      <h2>Test Title</h2>',
    '    </div>',
    '    <div class="pages">',
    '      <h3>Pages: 10</h3>',
    '    </div>',
    '    <div class="gallery">',
    '      <div class="preview_thumb"><img data-src="https://example.com/gallery/1t.jpg" /></div>',
    '    </div>',
    '  </body>',
    '</html>'
  ].join('\n');

  const result = await scrapeGalleryData(html);

  assert.equal(result.title, 'Test Title');
  assert.equal(result.pageCount, 10);
  assert.equal(result.imageUrls.length, 10);
  assert.ok(result.imageUrls[0] === 'https://example.com/gallery/1.jpg');
  assert.ok(result.imageUrls[9] === 'https://example.com/gallery/10.jpg');
});

test('scrapeGalleryData generates imageUrls from thumbnail pattern', async () => {
  ensureDomParser();

  const html = [
    '<html>',
    '  <body>',
    '    <div class="info">',
    '      <h2>Gallery Title</h2>',
    '    </div>',
    '    <div class="pages">',
    '      <h3>Pages: 3</h3>',
    '    </div>',
    '    <div class="gallery">',
    '      <div class="preview_thumb"><img data-src="https://images.site.com/017/554911/1t.jpg" /></div>',
    '      <div class="preview_thumb"><img data-src="https://images.site.com/017/554911/2t.jpg" /></div>',
    '      <div class="preview_thumb"><img data-src="https://images.site.com/017/554911/3t.jpg" /></div>',
    '    </div>',
    '  </body>',
    '</html>'
  ].join('\n');

  const result = await scrapeGalleryData(html);

  assert.equal(result.title, 'Gallery Title');
  assert.equal(result.pageCount, 3);
  assert.equal(result.imageUrls.length, 3);
  assert.deepEqual(result.imageUrls, [
    'https://images.site.com/017/554911/1.jpg',
    'https://images.site.com/017/554911/2.jpg',
    'https://images.site.com/017/554911/3.jpg'
  ]);
  assert.equal(result.warnings, undefined);
});

test('scrapeGalleryData handles missing pageCount with warning', async () => {
  ensureDomParser();

  const html = [
    '<html>',
    '  <body>',
    '    <div class="info">',
    '      <h2>Test Title</h2>',
    '    </div>',
    '    <div class="gallery">',
    '      <div class="preview_thumb"><img data-src="https://example.com/1t.jpg" /></div>',
    '      <div class="preview_thumb"><img data-src="https://example.com/2t.jpg" /></div>',
    '    </div>',
    '  </body>',
    '</html>'
  ].join('\n');

  const result = await scrapeGalleryData(html);

  assert.equal(result.title, 'Test Title');
  assert.equal(result.pageCount, 0);
  assert.equal(result.imageUrls.length, 0);
  assert.ok(result.warnings);
  assert.ok(result.warnings?.some(message => message.includes('page count')));
});

test('scrapeGalleryData fallback when URL pattern extraction fails', async () => {
  ensureDomParser();

  const html = [
    '<html>',
    '  <body>',
    '    <div class="info">',
    '      <h2>Test Title</h2>',
    '    </div>',
    '    <div class="pages">',
    '      <h3>Pages: 2</h3>',
    '    </div>',
    '    <div class="gallery">',
    '      <div class="preview_thumb"><img data-src="https://example.com/unexpected-format.jpg" /></div>',
    '      <div class="preview_thumb"><img data-src="https://example.com/another-format.jpg" /></div>',
    '    </div>',
    '  </body>',
    '</html>'
  ].join('\n');

  const result = await scrapeGalleryData(html);

  assert.equal(result.title, 'Test Title');
  assert.equal(result.pageCount, 2);
  assert.equal(result.imageUrls.length, 2);
  assert.deepEqual(result.imageUrls, [
    'https://example.com/unexpected-format.jpg',
    'https://example.com/another-format.jpg'
  ]);
  assert.ok(result.warnings);
  assert.ok(result.warnings?.some(message => message.includes('URL pattern')));
});
