import test from 'node:test';
import assert from 'node:assert/strict';

import { checkUrlAgainstPolicy, isIpLiteral, isLoopback, normalizeHost } from '../hostPolicy';
import { fromGalleryImageUrl, toGalleryImageUrl, GALLERY_IMAGE_SCHEME } from '../imageUrl';

const HOSTS = ['gallery.example.com', 'Images.Example.com', 'cdn.example.com:8443'];

const ok = (url: string, allowInsecure = false) => {
  const r = checkUrlAgainstPolicy(url, HOSTS, { allowInsecure });
  assert.ok(r.ok, `${url} should be allowed: ${!r.ok && r.reason}`);
};
const rejected = (url: string, reasonPart: string, allowInsecure = false) => {
  const r = checkUrlAgainstPolicy(url, HOSTS, { allowInsecure });
  assert.ok(!r.ok, `${url} should be rejected`);
  assert.match(!r.ok ? r.reason : '', new RegExp(reasonPart));
};

test('allows https URLs on listed hosts, case-insensitively', () => {
  ok('https://gallery.example.com/list');
  ok('https://images.example.com/full/1.jpg');
  ok('https://GALLERY.EXAMPLE.COM./x');
  ok('https://cdn.example.com:8443/a');
});

test('rejects unlisted hosts and sub-domains that are not listed explicitly', () => {
  rejected('https://evil.example.com/', 'allow list');
  rejected('https://sub.gallery.example.com/', 'allow list');
  rejected('https://gallery.example.com.evil.net/', 'allow list');
  rejected('https://cdn.example.com/', 'allow list', false); // listed only with :8443
});

test('rejects plain http unless insecure mode is on', () => {
  rejected('http://gallery.example.com/', 'Protocol');
  ok('http://gallery.example.com/', true);
});

test('rejects other schemes, credentials and IP literals', () => {
  rejected('file:///etc/passwd', 'Protocol');
  rejected('ftp://gallery.example.com/', 'Protocol');
  rejected('https://user:pw@gallery.example.com/', 'Credentials');
  rejected('https://127.0.0.1/', 'IP literal');
  rejected('https://[::1]/', 'IP literal');
  rejected('https://10.0.0.5/', 'IP literal');
  rejected('not a url', 'Invalid');
});

test('insecure mode admits loopback literals only when they are also listed', () => {
  const r1 = checkUrlAgainstPolicy('http://127.0.0.1:4000/img.png', ['127.0.0.1:4000'], { allowInsecure: true });
  assert.ok(r1.ok);
  const r2 = checkUrlAgainstPolicy('http://127.0.0.1:4000/img.png', ['gallery.example.com'], { allowInsecure: true });
  assert.ok(!r2.ok);
  const r3 = checkUrlAgainstPolicy('http://10.0.0.5/img.png', ['10.0.0.5'], { allowInsecure: true });
  assert.ok(!r3.ok, 'non-loopback literals stay blocked even in insecure mode');
});

test('host helpers', () => {
  assert.equal(normalizeHost(' Example.COM. '), 'example.com');
  assert.equal(isIpLiteral('192.168.0.1'), true);
  assert.equal(isIpLiteral('[::1]'), true);
  assert.equal(isIpLiteral('example.com'), false);
  assert.equal(isLoopback('localhost'), true);
  assert.equal(isLoopback('127.0.0.1'), true);
  assert.equal(isLoopback('[::1]'), true);
  assert.equal(isLoopback('192.168.0.1'), false);
});

test('gallery image URLs round-trip and reject foreign URLs', () => {
  const remote = 'https://images.example.com/full/1.jpg?x=1&y=ä';
  const internal = toGalleryImageUrl(remote);
  assert.ok(internal.startsWith(`${GALLERY_IMAGE_SCHEME}://fetch/?u=`));
  assert.equal(fromGalleryImageUrl(internal), remote);
  assert.equal(fromGalleryImageUrl('https://images.example.com/full/1.jpg'), null);
  assert.equal(fromGalleryImageUrl(`${GALLERY_IMAGE_SCHEME}://fetch/`), null);
  assert.equal(fromGalleryImageUrl('garbage'), null);
});
