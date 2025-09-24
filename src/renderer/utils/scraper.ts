export interface ScrapedData {
  title: string;
  pageCount: number;
  imageUrls: string[];
  warnings?: string[];
}

export class ScraperError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScraperError';
  }
}

const SELECTORS = {
  title: 'div.info > h2',
  thumbnails: 'div.gallery div.preview_thumb',
  image: 'img[data-src]'
} as const;

const ensureHtml = (html: string): string => {
  if (typeof html !== 'string') {
    throw new ScraperError('HTML content must be a string.');
  }

  const trimmed = html.trim();
  if (!trimmed) {
    throw new ScraperError('HTML content is empty.');
  }

  return trimmed;
};

const createDocument = (html: string): Document => {
  if (typeof DOMParser === 'undefined') {
    throw new ScraperError('DOMParser is not available in the current environment.');
  }

  const parser = new DOMParser();
  return parser.parseFromString(html, 'text/html');
};

export async function scrapeGalleryData(html: string): Promise<ScrapedData> {
  const safeHtml = ensureHtml(html);
  const doc = createDocument(safeHtml);

  if (doc.querySelector('parsererror')) {
    throw new ScraperError('Failed to parse HTML document.');
  }

  const warnings: string[] = [];

  const titleElement = doc.querySelector(SELECTORS.title);
  const title = titleElement?.textContent?.trim() ?? '';
  if (!title) {
    warnings.push('Missing gallery title.');
  }

  const thumbnails = Array.from(doc.querySelectorAll(SELECTORS.thumbnails));
  if (thumbnails.length === 0) {
    warnings.push('No gallery thumbnails were found.');
  }

  const imageUrls = thumbnails.reduce<string[]>((urls, thumb, index) => {
    const dataSrc = thumb.querySelector(SELECTORS.image)?.getAttribute('data-src')?.trim();

    if (dataSrc) {
      urls.push(dataSrc);
    } else {
      warnings.push(`Missing data-src attribute for thumbnail at index ${index}.`);
    }

    return urls;
  }, []);

  return {
    title,
    pageCount: thumbnails.length,
    imageUrls,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}
