/**
 * Sample site profile for a fictional gallery site at gallery.example.com.
 *
 * It exists so the engine, its tests and CI have a profile to run against
 * without a real site. The HTML shapes below are invented for this sample and
 * are also what `tests/fixtures` use. A real profile lives in `../private`
 * (git-ignored) and must export `siteProfile` with the same contract.
 */
import type {
  ExternalWork,
  ImagePageResult,
  ListPageResult,
  ListQuery,
  SiteProfile,
  Tag,
  WorkPageResult,
} from '../types';

const BASE_URL = 'https://gallery.example.com';
const IMAGE_HOST = 'images.example.com';

const CATEGORIES = [
  { id: 'comics', label: 'Comics' },
  { id: 'illustrations', label: 'Illustrations' },
  { id: 'photos', label: 'Photos' },
  { id: 'games', label: 'Games' },
  { id: 'misc', label: 'Misc' },
];

const TAG_NAMESPACES: Record<string, Tag['namespace']> = {
  artist: 'artist',
  language: 'language',
};

const text = (el: Element | null | undefined): string => el?.textContent?.trim() ?? '';

const absolute = (href: string | null | undefined, base: string): string | null => {
  if (!href) {
    return null;
  }
  try {
    return new URL(href, base).toString();
  } catch {
    return null;
  }
};

const parseTags = (root: ParentNode): Tag[] =>
  Array.from(root.querySelectorAll('li[data-ns]')).flatMap((li) => {
    const name = text(li);
    if (!name) {
      return [];
    }
    const ns = li.getAttribute('data-ns') ?? '';
    return [{ namespace: TAG_NAMESPACES[ns] ?? 'other', name }];
  });

function buildListUrl(query: ListQuery): string {
  const url = new URL('/list', BASE_URL);
  if (query.categoryIds.length > 0) {
    url.searchParams.set('cat', query.categoryIds.join(','));
  }
  if (query.language) {
    url.searchParams.set('lang', query.language);
  }
  if (query.cursor) {
    url.searchParams.set('page', query.cursor);
  }
  return url.toString();
}

function parseListPage(doc: Document, pageUrl: string): ListPageResult {
  const fetchedAt = new Date().toISOString();
  const works: ExternalWork[] = [];

  for (const item of Array.from(doc.querySelectorAll('li.work'))) {
    const id = item.getAttribute('data-id')?.trim();
    const url = absolute(item.querySelector('a.work-link')?.getAttribute('href'), pageUrl);
    if (!id || !url) {
      continue;
    }
    const pagesText = text(item.querySelector('.work-pages'));
    const pageCount = /^\d+$/.test(pagesText) ? Number(pagesText) : null;

    works.push({
      id,
      url,
      title: text(item.querySelector('.work-title')),
      categoryId: item.getAttribute('data-category')?.trim() ?? '',
      tags: parseTags(item),
      thumbnailUrl: absolute(item.querySelector('img.work-thumb')?.getAttribute('src'), pageUrl),
      pageCount,
      fetchedAt,
    });
  }

  const nextHref = absolute(doc.querySelector('a.next')?.getAttribute('href'), pageUrl);
  const nextCursor = nextHref ? new URL(nextHref).searchParams.get('page') : null;

  return { works, nextCursor };
}

function parseWorkPage(doc: Document, pageUrl: string): WorkPageResult {
  const pageUrls = Array.from(doc.querySelectorAll('a.page-link'))
    .map((a) => absolute(a.getAttribute('href'), pageUrl))
    .filter((u): u is string => u !== null);

  return {
    title: text(doc.querySelector('h1.work-title')),
    tags: parseTags(doc),
    pageUrls,
  };
}

function parseImagePage(doc: Document, pageUrl: string): ImagePageResult {
  const imageUrl = absolute(doc.querySelector('img#main-image')?.getAttribute('src'), pageUrl);
  if (!imageUrl) {
    throw new Error('Image page has no main image');
  }
  return { imageUrl };
}

export const exampleProfile: SiteProfile = {
  id: 'example',
  displayName: 'Sample Gallery (example.com)',
  allowedHosts: [new URL(BASE_URL).host, IMAGE_HOST],
  rateLimit: { minIntervalMs: 1000, maxConcurrency: 1 },
  categories: CATEGORIES,
  defaultCategoryIds: ['comics', 'illustrations', 'misc'],
  defaultLanguage: 'japanese',
  buildListUrl,
  parseListPage,
  parseWorkPage,
  parseImagePage,
};

/** Uniform export name so `@site-profile` resolves the same for example and private. */
export const siteProfile = exampleProfile;
