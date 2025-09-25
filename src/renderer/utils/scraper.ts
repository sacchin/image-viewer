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
  image: 'img[data-src]',
  pageCount: 'div.pages > h3'
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

  // Extract page count from h3 tag in div.pages
  const pageCountElement = doc.querySelector(SELECTORS.pageCount);
  const pageCountText = pageCountElement?.textContent?.trim() ?? '';
  const pageCountMatch = pageCountText.match(/Pages:\s*(\d+)/);
  const pageCount = pageCountMatch ? parseInt(pageCountMatch[1], 10) : 0;
  if (pageCount === 0) {
    warnings.push('Could not extract page count from pages section.');
  }

  const thumbnails = Array.from(doc.querySelectorAll(SELECTORS.thumbnails));
  if (thumbnails.length === 0) {
    warnings.push('No gallery thumbnails were found.');
  }

  // Get the first thumbnail URL to use as template
  let imageUrls: string[] = [];
  if (thumbnails.length > 0) {
    const firstThumb = thumbnails[0];
    const firstThumbnailUrl = firstThumb.querySelector(SELECTORS.image)?.getAttribute('data-src')?.trim();

    if (firstThumbnailUrl && pageCount > 0) {
      // Extract the base URL pattern from the thumbnail
      // Example: https://images.asmhentai.com/017/554911/1t.jpg -> https://images.asmhentai.com/017/554911/
      const match = firstThumbnailUrl.match(/^(.+\/)(\d+)t?\.\w+$/);
      if (match) {
        const baseUrl = match[1];
        // Generate URLs for all pages
        imageUrls = Array.from({ length: pageCount }, (_, i) => `${baseUrl}${i + 1}.jpg`);
      } else {
        warnings.push('Could not extract URL pattern from thumbnail.');
        // Fallback to original thumbnail URLs
        imageUrls = thumbnails.reduce<string[]>((urls, thumb, index) => {
          const dataSrc = thumb.querySelector(SELECTORS.image)?.getAttribute('data-src')?.trim();
          if (dataSrc) {
            urls.push(dataSrc);
          } else {
            warnings.push(`Missing data-src attribute for thumbnail at index ${index}.`);
          }
          return urls;
        }, []);
      }
    } else {
      warnings.push('Missing first thumbnail URL or page count.');
    }
  }

  return {
    title,
    pageCount,
    imageUrls,
    warnings: warnings.length > 0 ? warnings : undefined
  };
}
