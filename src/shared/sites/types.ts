/**
 * Site profile contract for the external gallery browser.
 *
 * Everything that identifies a concrete site (hosts, URL shapes, selectors,
 * category names, tag vocabulary) lives in a profile module. The engine in
 * main/renderer only talks to this interface, so the public repository never
 * has to mention a real site. A committed sample profile under `./example`
 * documents the contract; a real profile goes in the git-ignored `./private`.
 *
 * Profiles must be pure: no Node or Electron imports, no network access. They
 * receive already-fetched documents and return plain data. The same module is
 * loaded by the main process (for host allow-list and rate limits) and by the
 * renderer (for URL building and parsing).
 */

/** A tag as the site exposes it, normalised to a namespace + name pair. */
export interface Tag {
  /**
   * Profiles must map the site's own vocabulary onto these namespaces so the
   * engine can find artists without knowing the site. Anything that is not an
   * artist or a language goes to `other`.
   */
  namespace: 'artist' | 'language' | 'other';
  name: string;
}

/** A category the site lets the user browse by. Values are profile-defined. */
export interface SiteCategory {
  /** Opaque identifier the profile understands in `ListQuery.categoryIds`. */
  id: string;
  /** Human readable label for the UI. */
  label: string;
}

/** A work (gallery) as seen in a listing. Only URLs and metadata, never pixels. */
export interface ExternalWork {
  /** Stable identifier derived by the profile from the site's own ids. */
  id: string;
  /** Absolute URL of the work page. */
  url: string;
  title: string;
  /** One of `SiteProfile.categories[].id`, or '' when the listing omits it. */
  categoryId: string;
  tags: Tag[];
  /** Absolute URL of the thumbnail, or null when the listing has none. */
  thumbnailUrl: string | null;
  /** Page count when the listing shows it, otherwise null until the work page is fetched. */
  pageCount: number | null;
  /** ISO 8601 timestamp of when this record was parsed. */
  fetchedAt: string;
}

export interface ListQuery {
  /** Subset of `SiteProfile.categories[].id` to include. */
  categoryIds: string[];
  /** Site-specific language value (see `SiteProfile.defaultLanguage`). */
  language: string;
  /** Opaque continuation token from a previous `ListPageResult`, null for the first page. */
  cursor: string | null;
}

export interface ListPageResult {
  works: ExternalWork[];
  /** Token for the next page, or null when this was the last page. */
  nextCursor: string | null;
}

export interface WorkPageResult {
  title: string;
  tags: Tag[];
  /** Absolute URLs of the per-page documents, in reading order. */
  pageUrls: string[];
}

export interface ImagePageResult {
  /** Absolute URL of the full-size image shown on this page. */
  imageUrl: string;
}

export interface RateLimit {
  /** Minimum delay between two requests to the site, in milliseconds. */
  minIntervalMs: number;
  /** Maximum number of in-flight requests. */
  maxConcurrency: number;
}

export interface SiteProfile {
  /** Short machine id, e.g. 'example'. Used in log lines and storage keys. */
  id: string;
  /** Shown in the UI. */
  displayName: string;
  /**
   * Hosts the main process may fetch from on behalf of this profile (HTML and
   * images). Exact host names, compared case-insensitively. Sub-domains must be
   * listed explicitly.
   */
  allowedHosts: string[];
  rateLimit: RateLimit;
  /** All categories the site offers that the UI may expose. */
  categories: SiteCategory[];
  /** Categories selected when the user has not chosen any. */
  defaultCategoryIds: string[];
  /** Language value used when the user has not chosen one. */
  defaultLanguage: string;

  /** Build the absolute URL of a listing page for the given query. */
  buildListUrl(query: ListQuery): string;
  /** Extract works and the continuation token from a listing document. */
  parseListPage(doc: Document, pageUrl: string): ListPageResult;
  /** Extract metadata and per-page URLs from a work document. */
  parseWorkPage(doc: Document, pageUrl: string): WorkPageResult;
  /** Extract the full-size image URL from a single page document. */
  parseImagePage(doc: Document, pageUrl: string): ImagePageResult;
}

/** Runtime shape check used when loading an untyped private module. */
export function isSiteProfile(value: unknown): value is SiteProfile {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const p = value as Record<string, unknown>;
  const rate = p.rateLimit as Record<string, unknown> | undefined;
  return (
    typeof p.id === 'string' &&
    p.id.length > 0 &&
    typeof p.displayName === 'string' &&
    Array.isArray(p.allowedHosts) &&
    p.allowedHosts.every((h) => typeof h === 'string' && h.length > 0) &&
    !!rate &&
    typeof rate.minIntervalMs === 'number' &&
    typeof rate.maxConcurrency === 'number' &&
    Array.isArray(p.categories) &&
    Array.isArray(p.defaultCategoryIds) &&
    typeof p.defaultLanguage === 'string' &&
    typeof p.buildListUrl === 'function' &&
    typeof p.parseListPage === 'function' &&
    typeof p.parseWorkPage === 'function' &&
    typeof p.parseImagePage === 'function'
  );
}

/** Names of the artist tags on a work, in listing order, de-duplicated. */
export function artistNamesOf(tags: Tag[]): string[] {
  const seen = new Set<string>();
  const names: string[] = [];
  for (const tag of tags) {
    if (tag.namespace === 'artist' && !seen.has(tag.name)) {
      seen.add(tag.name);
      names.push(tag.name);
    }
  }
  return names;
}
