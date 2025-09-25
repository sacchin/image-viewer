import React, { useEffect, useMemo, useState } from 'react';
import './DownloadDialog.css';
import { scrapeGalleryData, ScrapedData } from '../../utils/scraper';

export interface DownloadJobPayload extends ScrapedData {
  url: string;
}

interface DownloadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onJobCreated: (job: DownloadJobPayload) => Promise<string | void>;
}

const createDefaultState = () => ({
  url: '',
  scrapedData: null as ScrapedData | null,
  error: null as string | null
});

const sanitizeUrl = (value: string): string => value.trim();

const isValidUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (error) {
    return false;
  }
};

const setGlobalScrapeResult = (data: ScrapedData | null) => {
  if (typeof window === 'undefined') {
    return;
  }

  if (data) {
    (window as any).__scrapeResult = data;
  } else {
    delete (window as any).__scrapeResult;
  }
};

const buildWarningMessage = (warnings?: string[]): string | null => {
  if (!warnings || warnings.length === 0) {
    return null;
  }

  return 'Missing gallery sections: ' + warnings.join(' ');
};

export const DownloadDialog: React.FC<DownloadDialogProps> = ({ isOpen, onClose, onJobCreated }) => {
  const [{ url, scrapedData, error }, setState] = useState(createDefaultState);
  const [isScraping, setIsScraping] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setState(createDefaultState());
      setIsScraping(false);
      setIsCreating(false);
      setGlobalScrapeResult(null);
    }
  }, [isOpen]);

  const handleUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setState(current => ({
      ...current,
      url: event.target.value,
      error: null
    }));
  };

  const scrapeDisabled = useMemo(() => {
    return isScraping;
  }, [isScraping]);

  const startDisabled = useMemo(() => {
    if (!scrapedData || scrapedData.imageUrls.length === 0) {
      return true;
    }

    return isCreating;
  }, [scrapedData, isCreating]);

  const handleScrape = async () => {
    const trimmedUrl = sanitizeUrl(url);

    if (!trimmedUrl) {
      setState(current => ({ ...current, error: 'URL is required.' }));
      setGlobalScrapeResult(null);
      return;
    }

    if (!isValidUrl(trimmedUrl)) {
      setState(current => ({ ...current, error: 'The URL format is invalid.' }));
      setGlobalScrapeResult(null);
      return;
    }

    setIsScraping(true);
    setState(current => ({ ...current, error: null, scrapedData: null }));
    setGlobalScrapeResult(null);

    try {
      const response = await window.electronAPI.fetchUrl(trimmedUrl);

      if (!response.success) {
        throw new Error(response.error || 'Failed to fetch page');
      }

      const html = response.html!;
      const data = await scrapeGalleryData(html);
      const warningMessage = buildWarningMessage(data.warnings);

      setState(current => ({ ...current, scrapedData: data, error: warningMessage }));
      setGlobalScrapeResult(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error occurred while scraping.';
      setState(current => ({ ...current, scrapedData: null, error: message }));
    } finally {
      setIsScraping(false);
    }
  };

  const handleCreateJob = async () => {
    if (!scrapedData || scrapedData.imageUrls.length === 0) {
      setState(current => ({
        ...current,
        error: scrapedData ? 'At least one image is required to start the download.' : current.error
      }));
      return;
    }

    setIsCreating(true);

    try {
      await onJobCreated({ ...scrapedData, url: sanitizeUrl(url) });
      setGlobalScrapeResult(null);
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create download job.';
      setState(current => ({ ...current, error: message }));
    } finally {
      setIsCreating(false);
    }
  };

  const handleCancel = () => {
    if (isCreating) {
      return;
    }

    onClose();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="download-dialog-backdrop" role="dialog" aria-modal="true">
      <div className="download-dialog" data-testid="download-dialog">
        <div className="download-dialog-header">
          <h3>Create Download Job</h3>
          <button
            type="button"
            className="download-dialog-close"
            onClick={handleCancel}
            aria-label="Close download dialog"
          >
            X
          </button>
        </div>

        <div className="download-dialog-body">
          <label htmlFor="download-dialog-url">Source URL</label>
          <div className="download-dialog-url-group">
            <input
              id="download-dialog-url"
              type="url"
              placeholder="https://example.com/gallery"
              value={url}
              onChange={handleUrlChange}
              autoFocus
              data-testid="download-dialog-url-input"
            />
            <button
              type="button"
              className="download-dialog-scrape"
              onClick={handleScrape}
              disabled={scrapeDisabled}
              data-testid="download-dialog-scrape-button"
            >
              {isScraping ? 'Scraping...' : 'Scrape'}
            </button>
          </div>

          {error && (
            <p className="download-dialog-error" data-testid="download-dialog-error">
              {error}
            </p>
          )}

          {scrapedData && (
            <div className="download-dialog-result" data-testid="download-dialog-scrape-result">
              <div className="download-dialog-summary">
                <h4 data-testid="download-dialog-scrape-title">{scrapedData.title}</h4>
                <span data-testid="download-dialog-scrape-page-count">
                  {scrapedData.pageCount} images
                </span>
              </div>
              <div className="download-dialog-url-list">
                {scrapedData.imageUrls.map((imageUrl, index) => (
                  <div key={imageUrl + index} className="download-dialog-url-item">
                    <span className="download-dialog-url-index">{index + 1}.</span>
                    <span className="download-dialog-url-text">{imageUrl}</span>
                  </div>
                ))}
                {scrapedData.imageUrls.length === 0 && (
                  <div className="download-dialog-url-item">No preview images found.</div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="download-dialog-footer">
          <button
            type="button"
            className="download-dialog-cancel"
            onClick={handleCancel}
            data-testid="download-dialog-cancel-button"
          >
            Cancel
          </button>
          <button
            type="button"
            className="download-dialog-submit"
            onClick={handleCreateJob}
            disabled={startDisabled}
            data-testid="download-dialog-start-button"
          >
            {isCreating ? 'Creating...' : 'Create Job'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DownloadDialog;
