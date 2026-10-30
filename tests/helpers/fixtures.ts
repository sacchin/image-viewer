import * as fs from 'fs/promises';
import * as http from 'http';
import * as os from 'os';
import * as path from 'path';
import type { AddressInfo } from 'net';

/** 1x1 transparent PNG, enough for <img> to load and report natural dimensions. */
export const TEST_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64'
);

/**
 * Create a short-named temp directory. Kept short so that a 200-character
 * folder name plus a file name still fits under the Windows MAX_PATH limit.
 */
export async function makeTempDir(prefix: string): Promise<string> {
  const dir = path.join(os.tmpdir(), `${prefix}-${Date.now().toString(36)}`);
  await fs.mkdir(dir, { recursive: true });
  return dir;
}

export async function removeDir(dir: string | undefined): Promise<void> {
  if (!dir) return;
  try {
    await fs.rm(dir, { recursive: true, force: true, maxRetries: 3 });
  } catch (error) {
    console.error(`Failed to clean up ${dir}:`, error);
  }
}

export interface FixtureTree {
  /** folder path (relative, posix separators) -> file names inside it */
  [folder: string]: string[];
}

/**
 * Materialise folders and files under root. Files with an image extension get
 * valid PNG bytes; anything else gets a short text body.
 */
export async function writeTree(root: string, tree: FixtureTree): Promise<void> {
  for (const [folder, files] of Object.entries(tree)) {
    const dir = path.join(root, ...folder.split('/').filter(Boolean));
    await fs.mkdir(dir, { recursive: true });
    for (const file of files) {
      const isImage = /\.(png|jpe?g|gif|bmp|webp)$/i.test(file);
      await fs.writeFile(path.join(dir, file), isImage ? TEST_PNG : `fixture ${file}`);
    }
  }
}

export interface ImageServer {
  /** e.g. http://127.0.0.1:54321 */
  baseUrl: string;
  /** Request paths received so far, in order */
  requests: string[];
  close(): Promise<void>;
}

/**
 * Local HTTP server that answers every GET with the test PNG, so download
 * tests exercise the real crawler without touching the network.
 */
export async function startImageServer(): Promise<ImageServer> {
  const requests: string[] = [];
  const server = http.createServer((req, res) => {
    requests.push(req.url ?? '');
    res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': TEST_PNG.length });
    res.end(TEST_PNG);
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    baseUrl: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
  };
}

export interface GalleryHtmlOptions {
  /** Gallery title; null omits the whole info section */
  title?: string | null;
  /** Number of pages; null omits the pages section */
  pageCount?: number | null;
  /** Base URL the thumbnails point to, e.g. http://127.0.0.1:1234/g/ */
  imageBase: string;
  /** Number of preview thumbnails to render (defaults to pageCount) */
  thumbnails?: number;
}

/**
 * Gallery page in the shape scraper.ts expects:
 * div.info > h2, div.pages > h3 and div.gallery div.preview_thumb img[data-src].
 */
export function galleryHtml(options: GalleryHtmlOptions): string {
  const { title = 'Sample Gallery', pageCount = 3, imageBase } = options;
  const thumbCount = options.thumbnails ?? pageCount ?? 0;
  const base = imageBase.endsWith('/') ? imageBase : `${imageBase}/`;
  const thumbs = Array.from(
    { length: thumbCount },
    (_, i) => `<div class="preview_thumb"><img data-src="${base}${i + 1}t.jpg" /></div>`
  ).join('\n      ');
  const info = title !== null ? `<div class="info"><h2>${title}</h2></div>` : '';
  const pages = pageCount !== null ? `<div class="pages"><h3>Pages: ${pageCount}</h3></div>` : '';
  return `
<html>
  <body>
    ${info}
    ${pages}
    <div class="gallery">
      ${thumbs}
    </div>
  </body>
</html>`;
}
