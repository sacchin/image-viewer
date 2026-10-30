import test from 'node:test';
import assert from 'node:assert/strict';
import { DOMParser as LinkedomDOMParser } from 'linkedom';

import { exampleProfile } from '../example';
import { artistNamesOf, isSiteProfile } from '../types';

const parse = (html: string): Document =>
  new LinkedomDOMParser().parseFromString(html, 'text/html') as unknown as Document;

const LIST_URL = 'https://gallery.example.com/list?cat=comics&lang=japanese';

const LIST_HTML = `
<html><body>
  <ul class="work-list">
    <li class="work" data-id="123" data-category="comics">
      <a class="work-link" href="/g/123/">
        <img class="work-thumb" src="https://images.example.com/thumbs/123.jpg" />
        <span class="work-title">First Work</span>
      </a>
      <ul class="work-tags">
        <li data-ns="artist">alice</li>
        <li data-ns="artist">bob</li>
        <li data-ns="language">japanese</li>
        <li data-ns="parody">some series</li>
      </ul>
      <span class="work-pages">24</span>
    </li>
    <li class="work" data-id="456" data-category="misc">
      <a class="work-link" href="/g/456/"><span class="work-title">Second Work</span></a>
      <ul class="work-tags"><li data-ns="artist">alice</li></ul>
    </li>
    <li class="work"><span class="work-title">Broken: no id or link</span></li>
  </ul>
  <a class="next" href="/list?cat=comics&lang=japanese&page=2">Next</a>
</body></html>`;

test('example profile satisfies the runtime contract check', () => {
  assert.equal(isSiteProfile(exampleProfile), true);
  assert.equal(isSiteProfile({ id: 'x' }), false);
  assert.equal(isSiteProfile(null), false);
});

test('buildListUrl encodes categories, language and cursor', () => {
  const first = new URL(
    exampleProfile.buildListUrl({ categoryIds: ['comics', 'misc'], language: 'japanese', cursor: null })
  );
  assert.equal(first.host, 'gallery.example.com');
  assert.equal(first.pathname, '/list');
  assert.equal(first.searchParams.get('cat'), 'comics,misc');
  assert.equal(first.searchParams.get('lang'), 'japanese');
  assert.equal(first.searchParams.has('page'), false);

  const next = new URL(exampleProfile.buildListUrl({ categoryIds: [], language: '', cursor: '3' }));
  assert.equal(next.searchParams.get('page'), '3');
  assert.equal(next.searchParams.has('cat'), false);
});

test('parseListPage extracts works, tags and the next cursor', () => {
  const result = exampleProfile.parseListPage(parse(LIST_HTML), LIST_URL);

  assert.equal(result.works.length, 2, 'items without id/link are skipped');
  assert.equal(result.nextCursor, '2');

  const [first, second] = result.works;
  assert.equal(first.id, '123');
  assert.equal(first.url, 'https://gallery.example.com/g/123/');
  assert.equal(first.title, 'First Work');
  assert.equal(first.categoryId, 'comics');
  assert.equal(first.thumbnailUrl, 'https://images.example.com/thumbs/123.jpg');
  assert.equal(first.pageCount, 24);
  assert.deepEqual(first.tags, [
    { namespace: 'artist', name: 'alice' },
    { namespace: 'artist', name: 'bob' },
    { namespace: 'language', name: 'japanese' },
    { namespace: 'other', name: 'some series' },
  ]);
  assert.deepEqual(artistNamesOf(first.tags), ['alice', 'bob']);
  assert.ok(!Number.isNaN(Date.parse(first.fetchedAt)));

  assert.equal(second.thumbnailUrl, null);
  assert.equal(second.pageCount, null);
});

test('parseListPage returns a null cursor on the last page', () => {
  const html = '<html><body><ul class="work-list"></ul></body></html>';
  const result = exampleProfile.parseListPage(parse(html), LIST_URL);
  assert.deepEqual(result.works, []);
  assert.equal(result.nextCursor, null);
});

test('parseWorkPage extracts title, tags and page urls', () => {
  const html = `
<html><body>
  <h1 class="work-title">First Work</h1>
  <ul class="tags"><li data-ns="artist">alice</li><li data-ns="group">circle</li></ul>
  <div class="pages">
    <a class="page-link" href="/g/123/1/">1</a>
    <a class="page-link" href="/g/123/2/">2</a>
  </div>
</body></html>`;
  const result = exampleProfile.parseWorkPage(parse(html), 'https://gallery.example.com/g/123/');
  assert.equal(result.title, 'First Work');
  assert.deepEqual(result.tags, [
    { namespace: 'artist', name: 'alice' },
    { namespace: 'other', name: 'circle' },
  ]);
  assert.deepEqual(result.pageUrls, [
    'https://gallery.example.com/g/123/1/',
    'https://gallery.example.com/g/123/2/',
  ]);
});

test('parseImagePage returns the absolute image url or throws', () => {
  const ok = exampleProfile.parseImagePage(
    parse('<html><body><img id="main-image" src="//images.example.com/full/123/1.jpg"></body></html>'),
    'https://gallery.example.com/g/123/1/'
  );
  assert.equal(ok.imageUrl, 'https://images.example.com/full/123/1.jpg');

  assert.throws(() =>
    exampleProfile.parseImagePage(parse('<html><body></body></html>'), 'https://gallery.example.com/g/123/1/')
  );
});

test('allowedHosts covers both the page host and the image host', () => {
  assert.deepEqual(exampleProfile.allowedHosts, ['gallery.example.com', 'images.example.com']);
});
