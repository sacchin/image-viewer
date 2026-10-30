import test from 'node:test';
import assert from 'node:assert/strict';

import { ExternalFetcher, FetchError, type Transport, type TransportResponse } from '../external/fetcher';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46]);

type Route = Partial<TransportResponse> | ((url: URL) => Partial<TransportResponse>);

/** Fake transport: answers from a URL -> response table and records calls. */
const makeTransport = (routes: Record<string, Route>) => {
  const calls: Array<{ url: string; headers: Record<string, string> }> = [];
  const transport: Transport = async (url, request) => {
    calls.push({ url: url.toString(), headers: request.headers });
    const route = routes[url.toString()];
    if (!route) {
      return { status: 404, headers: {}, body: Buffer.alloc(0) };
    }
    const r = typeof route === 'function' ? route(url) : route;
    return { status: r.status ?? 200, headers: r.headers ?? {}, body: r.body ?? Buffer.alloc(0) };
  };
  return { transport, calls };
};

const immediate = { now: () => 0, sleep: () => Promise.resolve() };

const makeFetcher = (transport: Transport, extra: Partial<ConstructorParameters<typeof ExternalFetcher>[0]> = {}) =>
  new ExternalFetcher({
    allowedHosts: ['gallery.example.com', 'images.example.com'],
    rateLimit: { minIntervalMs: 0, maxConcurrency: 1 },
    transport,
    rateLimiterDeps: immediate,
    ...extra,
  });

const expectKind = async (p: Promise<unknown>, kind: FetchError['kind'], messagePart?: RegExp) => {
  await assert.rejects(p, (err: unknown) => {
    assert.ok(err instanceof FetchError, `expected FetchError, got ${String(err)}`);
    assert.equal(err.kind, kind);
    if (messagePart) {
      assert.match(err.message, messagePart);
    }
    return true;
  });
};

test('fetchDocument returns decoded HTML and sends a fixed UA without cookies', async () => {
  const html = '<html><body>こんにちは</body></html>';
  const { transport, calls } = makeTransport({
    'https://gallery.example.com/list': {
      headers: { 'content-type': 'text/html; charset=utf-8' },
      body: Buffer.from(html, 'utf8'),
    },
  });
  const fetcher = makeFetcher(transport);

  assert.equal(await fetcher.fetchDocument('https://gallery.example.com/list'), html);
  assert.equal(calls.length, 1);
  assert.match(calls[0].headers['User-Agent'], /^Mozilla\/5\.0/);
  assert.equal(Object.keys(calls[0].headers).some((h) => h.toLowerCase() === 'cookie'), false);
});

test('fetchDocument honours a non-utf8 charset', async () => {
  const body = new TextEncoder().encode('x'); // keep it ascii so the assertion is encoding-agnostic
  const { transport } = makeTransport({
    'https://gallery.example.com/sjis': {
      headers: { 'content-type': 'text/html; charset=Shift_JIS' },
      body: Buffer.from(body),
    },
  });
  assert.equal(await makeFetcher(transport).fetchDocument('https://gallery.example.com/sjis'), 'x');
});

test('policy violations are rejected before any request is made', async () => {
  const { transport, calls } = makeTransport({});
  const fetcher = makeFetcher(transport);

  await expectKind(fetcher.fetchDocument('https://evil.example.net/'), 'policy', /allow list/);
  await expectKind(fetcher.fetchDocument('http://gallery.example.com/'), 'policy', /Protocol/);
  await expectKind(fetcher.fetchImage('https://127.0.0.1/x.jpg'), 'policy', /IP literal/);
  assert.equal(calls.length, 0);
});

test('redirects are followed within the allow list and resolved relatively', async () => {
  const { transport, calls } = makeTransport({
    'https://gallery.example.com/old': { status: 302, headers: { location: '/new' } },
    'https://gallery.example.com/new': {
      status: 301,
      headers: { location: 'https://images.example.com/final' },
    },
    'https://images.example.com/final': {
      headers: { 'content-type': 'text/html' },
      body: Buffer.from('<p>done</p>'),
    },
  });
  assert.equal(await makeFetcher(transport).fetchDocument('https://gallery.example.com/old'), '<p>done</p>');
  assert.deepEqual(
    calls.map((c) => c.url),
    ['https://gallery.example.com/old', 'https://gallery.example.com/new', 'https://images.example.com/final']
  );
});

test('a redirect to a host outside the allow list is rejected', async () => {
  const { transport, calls } = makeTransport({
    'https://gallery.example.com/go': { status: 302, headers: { location: 'https://tracker.example.net/' } },
  });
  await expectKind(makeFetcher(transport).fetchDocument('https://gallery.example.com/go'), 'policy');
  assert.equal(calls.length, 1, 'the off-list hop is never requested');
});

test('redirect loops and redirects without Location are rejected', async () => {
  const { transport } = makeTransport({
    'https://gallery.example.com/loop': { status: 302, headers: { location: '/loop' } },
    'https://gallery.example.com/nowhere': { status: 302, headers: {} },
  });
  const fetcher = makeFetcher(transport);
  await expectKind(fetcher.fetchDocument('https://gallery.example.com/loop'), 'redirect', /Too many/);
  await expectKind(fetcher.fetchDocument('https://gallery.example.com/nowhere'), 'redirect', /Location/);
});

test('non-200 and non-HTML responses are rejected', async () => {
  const { transport } = makeTransport({
    'https://gallery.example.com/missing': { status: 404 },
    'https://gallery.example.com/json': {
      headers: { 'content-type': 'application/json' },
      body: Buffer.from('{}'),
    },
  });
  const fetcher = makeFetcher(transport);
  await expectKind(fetcher.fetchDocument('https://gallery.example.com/missing'), 'http', /404/);
  await expectKind(fetcher.fetchDocument('https://gallery.example.com/json'), 'validation', /HTML/);
});

test('fetchImage sniffs the bytes, ignores the declared type, and caches', async () => {
  const { transport, calls } = makeTransport({
    'https://images.example.com/1.jpg': {
      headers: { 'content-type': 'application/octet-stream' },
      body: JPEG,
    },
  });
  const fetcher = makeFetcher(transport);

  const first = await fetcher.fetchImage('https://images.example.com/1.jpg');
  assert.equal(first.mimeType, 'image/jpeg');
  assert.ok(first.bytes.equals(JPEG));

  const second = await fetcher.fetchImage('https://images.example.com/1.jpg');
  assert.equal(second, first, 'served from cache');
  assert.equal(calls.length, 1);
  assert.equal(fetcher.imageCacheBytes, JPEG.byteLength);

  fetcher.clearImageCache();
  assert.equal(fetcher.imageCacheBytes, 0);
});

test('fetchImage rejects SVG and HTML even when labelled as images', async () => {
  const { transport } = makeTransport({
    'https://images.example.com/evil.svg': {
      headers: { 'content-type': 'image/svg+xml' },
      body: Buffer.from('<svg onload="alert(1)"/>'),
    },
    'https://images.example.com/fake.png': {
      headers: { 'content-type': 'image/png' },
      body: Buffer.from('<html>not an image</html>'),
    },
  });
  const fetcher = makeFetcher(transport);
  await expectKind(fetcher.fetchImage('https://images.example.com/evil.svg'), 'validation');
  await expectKind(fetcher.fetchImage('https://images.example.com/fake.png'), 'validation');
  assert.equal(fetcher.imageCacheBytes, 0, 'rejected bytes are not cached');
});

test('requests go through the rate limiter', async () => {
  const sleeps: number[] = [];
  let t = 0;
  const { transport } = makeTransport({
    'https://gallery.example.com/a': { headers: { 'content-type': 'text/html' }, body: Buffer.from('a') },
    'https://gallery.example.com/b': { headers: { 'content-type': 'text/html' }, body: Buffer.from('b') },
  });
  const fetcher = makeFetcher(transport, {
    rateLimit: { minIntervalMs: 1500, maxConcurrency: 1 },
    rateLimiterDeps: {
      now: () => t,
      sleep: (ms) => {
        sleeps.push(ms);
        t += ms;
        return Promise.resolve();
      },
    },
  });
  await Promise.all([
    fetcher.fetchDocument('https://gallery.example.com/a'),
    fetcher.fetchDocument('https://gallery.example.com/b'),
  ]);
  assert.deepEqual(sleeps, [1500]);
});

test('insecure mode is required for a local http fixture host', async () => {
  const { transport } = makeTransport({
    'http://127.0.0.1:4100/page': { headers: { 'content-type': 'text/html' }, body: Buffer.from('ok') },
  });
  const strict = makeFetcher(transport, { allowedHosts: ['127.0.0.1:4100'] });
  await expectKind(strict.fetchDocument('http://127.0.0.1:4100/page'), 'policy');

  const dev = makeFetcher(transport, { allowedHosts: ['127.0.0.1:4100'], allowInsecure: true });
  assert.equal(await dev.fetchDocument('http://127.0.0.1:4100/page'), 'ok');
});
