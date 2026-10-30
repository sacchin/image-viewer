import test from 'node:test';
import assert from 'node:assert/strict';
import * as http from 'node:http';
import type { AddressInfo } from 'node:net';

import { FetchError, nodeTransport } from '../external/fetcher';

/** Real round trips against a throwaway local server, no redirects involved. */
const withServer = async (
  handler: http.RequestListener,
  run: (base: URL) => Promise<void>
): Promise<void> => {
  const server = http.createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  try {
    await run(new URL(`http://127.0.0.1:${port}/`));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
};

const request = { headers: { 'User-Agent': 'test' }, maxBytes: 1024, timeoutMs: 2000 };

test('returns status, lower-cased headers and the full body', async () => {
  await withServer(
    (req, res) => {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Seen-UA', req.headers['user-agent'] ?? '');
      res.end('<p>hi</p>');
    },
    async (base) => {
      const r = await nodeTransport(new URL('/x', base), request);
      assert.equal(r.status, 200);
      assert.equal(r.headers['content-type'], 'text/html; charset=utf-8');
      assert.equal(r.headers['x-seen-ua'], 'test');
      assert.equal(r.body.toString(), '<p>hi</p>');
    }
  );
});

test('does not follow redirects itself', async () => {
  await withServer(
    (_req, res) => {
      res.statusCode = 302;
      res.setHeader('Location', '/elsewhere');
      res.end();
    },
    async (base) => {
      const r = await nodeTransport(base, request);
      assert.equal(r.status, 302);
      assert.equal(r.headers.location, '/elsewhere');
    }
  );
});

test('rejects bodies over maxBytes, declared or streamed', async () => {
  await withServer(
    (req, res) => {
      if (req.url === '/declared') {
        res.setHeader('Content-Length', '5000');
        res.end(Buffer.alloc(5000));
      } else {
        // chunked: no Content-Length, so the cap must trip while streaming
        res.write(Buffer.alloc(800));
        res.write(Buffer.alloc(800));
        res.end();
      }
    },
    async (base) => {
      for (const path of ['/declared', '/streamed']) {
        await assert.rejects(nodeTransport(new URL(path, base), request), (err: unknown) => {
          assert.ok(err instanceof FetchError);
          assert.equal(err.kind, 'validation');
          return true;
        });
      }
    }
  );
});

test('times out when the server never answers', async () => {
  await withServer(
    () => {
      /* never respond */
    },
    async (base) => {
      await assert.rejects(nodeTransport(base, { ...request, timeoutMs: 200 }), (err: unknown) => {
        assert.ok(err instanceof FetchError);
        assert.equal(err.kind, 'network');
        assert.match(err.message, /Timed out/);
        return true;
      });
    }
  );
});
