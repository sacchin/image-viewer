/**
 * The only code path through which the app talks to the external site.
 *
 * - every hop (including redirects) is checked against the profile allow list
 * - requests are serialised by `RateLimiter`
 * - documents are size-capped and must be text/html
 * - images are size-capped, sniffed by magic bytes and cached in memory only
 * - no cookies are ever sent; the User-Agent is fixed
 *
 * The HTTP transport is injectable so the policy logic is unit-testable
 * without a network. `nodeTransport` is the production implementation and
 * uses Node's http(s) modules rather than Chromium's net stack, so nothing
 * lands in Chromium's disk cache.
 */
import * as http from 'http';
import * as https from 'https';
import type { RateLimit } from '../../shared/sites/types';
import { checkUrlAgainstPolicy } from '../../shared/external/hostPolicy';
import { RateLimiter, type RateLimiterDeps } from './rateLimiter';
import { sniffImageType, type ImageMime } from './imageValidation';
import { ByteLruCache } from './lruCache';

export type FetchErrorKind = 'policy' | 'network' | 'http' | 'redirect' | 'validation';

export class FetchError extends Error {
  constructor(
    message: string,
    public readonly kind: FetchErrorKind
  ) {
    super(message);
    this.name = 'FetchError';
  }
}

export interface TransportRequest {
  headers: Record<string, string>;
  maxBytes: number;
  timeoutMs: number;
}

export interface TransportResponse {
  status: number;
  /** Lower-cased header names. */
  headers: Record<string, string | undefined>;
  body: Buffer;
}

/** One HTTP round trip, no redirect following. */
export type Transport = (url: URL, request: TransportRequest) => Promise<TransportResponse>;

export interface FetchedImage {
  bytes: Buffer;
  mimeType: ImageMime;
}

export interface ExternalFetcherOptions {
  allowedHosts: string[];
  rateLimit: RateLimit;
  /** See `HostPolicyOptions.allowInsecure`. */
  allowInsecure?: boolean;
  maxDocumentBytes?: number;
  maxImageBytes?: number;
  timeoutMs?: number;
  imageCacheBytes?: number;
  transport?: Transport;
  rateLimiterDeps?: RateLimiterDeps;
}

const DEFAULTS = {
  maxDocumentBytes: 5 * 1024 * 1024,
  maxImageBytes: 40 * 1024 * 1024,
  timeoutMs: 30_000,
  imageCacheBytes: 256 * 1024 * 1024,
  maxRedirects: 5,
};

// A fixed, ordinary desktop UA. Never derived from the Electron version so it
// does not change between builds.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const flattenHeaders = (headers: http.IncomingHttpHeaders): Record<string, string | undefined> => {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(headers)) {
    out[key.toLowerCase()] = Array.isArray(value) ? value.join(', ') : value;
  }
  return out;
};

export const nodeTransport: Transport = (url, request) =>
  new Promise((resolve, reject) => {
    const mod = url.protocol === 'http:' ? http : https;
    const req = mod.request(url, { method: 'GET', headers: request.headers }, (res) => {
      const status = res.statusCode ?? 0;
      const declared = Number(res.headers['content-length']);
      if (Number.isFinite(declared) && declared > request.maxBytes) {
        res.destroy();
        reject(new FetchError(`Response too large (${declared} bytes)`, 'validation'));
        return;
      }
      const chunks: Buffer[] = [];
      let total = 0;
      res.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > request.maxBytes) {
          res.destroy();
          reject(new FetchError('Response exceeded size limit', 'validation'));
          return;
        }
        chunks.push(chunk);
      });
      res.on('end', () =>
        resolve({ status, headers: flattenHeaders(res.headers), body: Buffer.concat(chunks) })
      );
      res.on('error', (err) => reject(new FetchError(err.message, 'network')));
    });
    req.setTimeout(request.timeoutMs, () => req.destroy(new Error(`Timed out after ${request.timeoutMs}ms`)));
    req.on('error', (err) => reject(new FetchError(err.message, 'network')));
    req.end();
  });

const charsetOf = (contentType: string | undefined): string => {
  const match = /charset=([^;\s]+)/i.exec(contentType ?? '');
  return match ? match[1].replace(/^"|"$/g, '') : 'utf-8';
};

const decodeHtml = (body: Buffer, contentType: string | undefined): string => {
  const charset = charsetOf(contentType);
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
};

export class ExternalFetcher {
  private readonly limiter: RateLimiter;
  private readonly transport: Transport;
  private readonly imageCache: ByteLruCache<FetchedImage>;
  private readonly opts: Required<
    Omit<ExternalFetcherOptions, 'transport' | 'rateLimiterDeps' | 'allowInsecure'>
  > & { allowInsecure: boolean };

  constructor(options: ExternalFetcherOptions) {
    this.opts = {
      allowedHosts: options.allowedHosts,
      rateLimit: options.rateLimit,
      allowInsecure: options.allowInsecure ?? false,
      maxDocumentBytes: options.maxDocumentBytes ?? DEFAULTS.maxDocumentBytes,
      maxImageBytes: options.maxImageBytes ?? DEFAULTS.maxImageBytes,
      timeoutMs: options.timeoutMs ?? DEFAULTS.timeoutMs,
      imageCacheBytes: options.imageCacheBytes ?? DEFAULTS.imageCacheBytes,
    };
    this.limiter = new RateLimiter(options.rateLimit, options.rateLimiterDeps);
    this.transport = options.transport ?? nodeTransport;
    this.imageCache = new ByteLruCache<FetchedImage>(this.opts.imageCacheBytes, (v) => v.bytes.byteLength);
  }

  /** Fetch an HTML document from an allowed host. Resolves to the decoded markup. */
  async fetchDocument(url: string): Promise<string> {
    const response = await this.request(url, this.opts.maxDocumentBytes, {
      Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
    });
    if (response.status !== 200) {
      throw new FetchError(`HTTP ${response.status}`, 'http');
    }
    const contentType = response.headers['content-type'];
    if (contentType && !/^(text\/html|application\/xhtml\+xml)\b/i.test(contentType)) {
      throw new FetchError(`Expected an HTML document, got ${contentType}`, 'validation');
    }
    return decodeHtml(response.body, contentType);
  }

  /** Fetch and validate a raster image. Served from the in-memory cache when possible. */
  async fetchImage(url: string): Promise<FetchedImage> {
    const cached = this.imageCache.get(url);
    if (cached) {
      return cached;
    }
    const response = await this.request(url, this.opts.maxImageBytes, {
      Accept: 'image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.1',
    });
    if (response.status !== 200) {
      throw new FetchError(`HTTP ${response.status}`, 'http');
    }
    const mimeType = sniffImageType(response.body);
    if (!mimeType) {
      throw new FetchError('Response is not a supported raster image', 'validation');
    }
    const image = { bytes: response.body, mimeType };
    this.imageCache.set(url, image);
    return image;
  }

  /** Bytes currently held by the image cache (for diagnostics and tests). */
  get imageCacheBytes(): number {
    return this.imageCache.bytes;
  }

  clearImageCache(): void {
    this.imageCache.clear();
  }

  private async request(
    initialUrl: string,
    maxBytes: number,
    extraHeaders: Record<string, string>
  ): Promise<TransportResponse> {
    let current = initialUrl;
    for (let hop = 0; hop <= DEFAULTS.maxRedirects; hop++) {
      const check = checkUrlAgainstPolicy(current, this.opts.allowedHosts, {
        allowInsecure: this.opts.allowInsecure,
      });
      if (!check.ok) {
        throw new FetchError(check.reason, 'policy');
      }
      const target = check.url;

      const response = await this.limiter.schedule(() =>
        this.transport(target, {
          headers: {
            'User-Agent': USER_AGENT,
            'Accept-Language': 'ja,en;q=0.8',
            ...extraHeaders,
          },
          maxBytes,
          timeoutMs: this.opts.timeoutMs,
        })
      );

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.location;
        if (!location) {
          throw new FetchError(`HTTP ${response.status} without Location`, 'redirect');
        }
        try {
          current = new URL(location, target).toString();
        } catch {
          throw new FetchError(`Invalid redirect location: ${location}`, 'redirect');
        }
        continue;
      }
      return response;
    }
    throw new FetchError(`Too many redirects (limit ${DEFAULTS.maxRedirects})`, 'redirect');
  }
}
