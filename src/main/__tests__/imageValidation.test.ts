import test from 'node:test';
import assert from 'node:assert/strict';

import { sniffImageType } from '../external/imageValidation';
import { ByteLruCache } from '../external/lruCache';

const bytes = (...parts: Array<number[] | string>): Uint8Array =>
  Uint8Array.from(
    parts.flatMap((p) => (typeof p === 'string' ? Array.from(p, (c) => c.charCodeAt(0)) : p))
  );

test('recognises the four accepted raster formats', () => {
  assert.equal(sniffImageType(bytes([0xff, 0xd8, 0xff, 0xe0], 'JFIF')), 'image/jpeg');
  assert.equal(sniffImageType(bytes([0x89], 'PNG', [0x0d, 0x0a, 0x1a, 0x0a], 'IHDR')), 'image/png');
  assert.equal(sniffImageType(bytes('GIF89a', [0, 0])), 'image/gif');
  assert.equal(sniffImageType(bytes('GIF87a', [0, 0])), 'image/gif');
  assert.equal(sniffImageType(bytes('RIFF', [0, 0, 0, 0], 'WEBPVP8 ')), 'image/webp');
});

test('rejects SVG, HTML, text and truncated or empty input', () => {
  assert.equal(sniffImageType(bytes('<svg xmlns="http://www.w3.org/2000/svg">')), null);
  assert.equal(sniffImageType(bytes('<!DOCTYPE html><html>')), null);
  assert.equal(sniffImageType(bytes('RIFF', [0, 0, 0, 0], 'WAVEfmt ')), null, 'RIFF but not WEBP');
  assert.equal(sniffImageType(bytes([0xff, 0xd8])), null, 'too short for JPEG');
  assert.equal(sniffImageType(bytes()), null);
  assert.equal(sniffImageType(bytes('BM', [0, 0, 0, 0])), null, 'BMP is not accepted');
});

test('byte LRU evicts the least recently used entry first', () => {
  const cache = new ByteLruCache<Uint8Array>(10, (v) => v.byteLength);
  cache.set('a', new Uint8Array(4));
  cache.set('b', new Uint8Array(4));
  assert.equal(cache.bytes, 8);

  cache.get('a'); // a is now most recent
  cache.set('c', new Uint8Array(4)); // 12 > 10: evict b
  assert.equal(cache.get('b'), undefined);
  assert.ok(cache.get('a'));
  assert.ok(cache.get('c'));
  assert.equal(cache.bytes, 8);
});

test('byte LRU ignores entries larger than its capacity and replaces same keys', () => {
  const cache = new ByteLruCache<Uint8Array>(10, (v) => v.byteLength);
  cache.set('huge', new Uint8Array(11));
  assert.equal(cache.size, 0);

  cache.set('k', new Uint8Array(3));
  cache.set('k', new Uint8Array(5));
  assert.equal(cache.size, 1);
  assert.equal(cache.bytes, 5);

  cache.clear();
  assert.equal(cache.size, 0);
  assert.equal(cache.bytes, 0);
});
