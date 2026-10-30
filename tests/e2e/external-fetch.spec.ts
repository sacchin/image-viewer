import { test, expect } from '@playwright/test';
import * as http from 'http';
import type { AddressInfo } from 'net';
import { ElectronAppHelper } from '../helpers/electron-app';

/**
 * End-to-end check of the external gallery transport: the main process must
 * be the only way to the "site" (a local fixture server here), images must be
 * sniffed before the renderer sees them, and the renderer's CSP must block a
 * direct request.
 */

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

interface Fixture {
  base: string;
  host: string;
  hits: Record<string, number>;
  close: () => Promise<void>;
}

async function startFixtureServer(): Promise<Fixture> {
  const hits: Record<string, number> = {};
  const server = http.createServer((req, res) => {
    // Route and count by path so a cache-busting query still hits the same file
    const url = new URL(req.url ?? '/', 'http://fixture').pathname;
    hits[url] = (hits[url] ?? 0) + 1;
    switch (url) {
      case '/ok.png':
        res.setHeader('Content-Type', 'image/png');
        res.end(PNG_1X1);
        return;
      case '/evil.svg':
        res.setHeader('Content-Type', 'image/svg+xml');
        res.end('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>');
        return;
      case '/fake.png':
        res.setHeader('Content-Type', 'image/png');
        res.end('<html>not an image</html>');
        return;
      case '/page.html':
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.end('<html><body><h1 class="work-title">Fixture Work</h1></body></html>');
        return;
      default:
        res.statusCode = 404;
        res.end('not found');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    base: `http://127.0.0.1:${port}`,
    host: `127.0.0.1:${port}`,
    hits,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}

/** Load an <img> in the renderer and report whether it decoded. */
const loadImage = (page: import('@playwright/test').Page, src: string) =>
  page.evaluate(
    (s) =>
      new Promise<{ ok: boolean; width: number }>((resolve) => {
        const img = new Image();
        img.onload = () => resolve({ ok: true, width: img.naturalWidth });
        img.onerror = () => resolve({ ok: false, width: 0 });
        img.src = s;
      }),
    src
  );

const galleryUrl = (remote: string) => `gallery-image://fetch/?u=${encodeURIComponent(remote)}`;

test.describe('External gallery transport', () => {
  let fixture: Fixture;
  let app: ElectronAppHelper;

  test.beforeAll(async () => {
    fixture = await startFixtureServer();
  });

  test.afterAll(async () => {
    await fixture.close();
  });

  test.beforeEach(async () => {
    for (const key of Object.keys(fixture.hits)) {
      delete fixture.hits[key];
    }
    process.env.EXTERNAL_GALLERY_ALLOW_INSECURE = '1';
    process.env.EXTERNAL_GALLERY_EXTRA_HOSTS = fixture.host;
    app = new ElectronAppHelper();
    await app.launch();
  });

  test.afterEach(async () => {
    delete process.env.EXTERNAL_GALLERY_ALLOW_INSECURE;
    delete process.env.EXTERNAL_GALLERY_EXTRA_HOSTS;
    await app.close();
  });

  test('serves a real raster image through gallery-image: and caches it', async () => {
    const page = app.getWindow();
    const first = await loadImage(page, galleryUrl(`${fixture.base}/ok.png`));
    expect(first).toEqual({ ok: true, width: 1 });
    expect(fixture.hits['/ok.png']).toBe(1);

    // Same URL again: must come from the in-memory cache, not the server
    const again = await loadImage(page, galleryUrl(`${fixture.base}/ok.png`));
    expect(again.ok).toBe(true);
    expect(fixture.hits['/ok.png']).toBe(1);

    // A different URL is a different cache key and does go to the server
    const variant = await loadImage(page, galleryUrl(`${fixture.base}/ok.png?v=2`));
    expect(variant.ok).toBe(true);
    expect(fixture.hits['/ok.png']).toBe(2);
  });

  test('refuses SVG and mislabelled bytes even with an image Content-Type', async () => {
    const page = app.getWindow();
    expect((await loadImage(page, galleryUrl(`${fixture.base}/evil.svg`))).ok).toBe(false);
    expect((await loadImage(page, galleryUrl(`${fixture.base}/fake.png`))).ok).toBe(false);
  });

  test('refuses hosts outside the allow list and malformed requests', async () => {
    const page = app.getWindow();
    expect((await loadImage(page, galleryUrl('http://127.0.0.1:9/ok.png'))).ok).toBe(false);
    expect((await loadImage(page, galleryUrl('https://not-allowed.example.net/ok.png'))).ok).toBe(false);
    expect((await loadImage(page, 'gallery-image://fetch/')).ok).toBe(false);
  });

  test('the renderer cannot reach the site directly (CSP)', async () => {
    const page = app.getWindow();
    const direct = await loadImage(page, `${fixture.base}/ok.png`);
    expect(direct.ok).toBe(false);
    expect(fixture.hits['/ok.png'] ?? 0).toBe(0);
  });

  test('fetchExternalDocument returns HTML for allowed hosts and a policy error otherwise', async () => {
    const page = app.getWindow();
    const ok = await page.evaluate((url) => window.electronAPI.fetchExternalDocument(url), `${fixture.base}/page.html`);
    expect(ok.success).toBe(true);
    if (ok.success) {
      expect(ok.html).toContain('Fixture Work');
    }

    const denied = await page.evaluate(
      (url) => window.electronAPI.fetchExternalDocument(url),
      'https://not-allowed.example.net/page.html'
    );
    expect(denied.success).toBe(false);
    if (!denied.success) {
      expect(denied.kind).toBe('policy');
    }

    const missing = await page.evaluate((url) => window.electronAPI.fetchExternalDocument(url), `${fixture.base}/nope`);
    expect(missing.success).toBe(false);
    if (!missing.success) {
      expect(missing.kind).toBe('http');
    }
  });
});
