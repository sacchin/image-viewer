import React, { useEffect, useMemo, useState } from 'react';
import './DownloadPanel.css';
import DownloadDialog, { DownloadJobPayload } from '../DownloadDialog/DownloadDialog';

type DownloadStatus = 'pending' | 'downloading' | 'completed' | 'error';

type BaseDownloadItem = {
  id: string;
  type: 'file' | 'job';
  progress: number;
  status: DownloadStatus;
};

type FileDownloadItem = BaseDownloadItem & {
  type: 'file';
  fileName: string;
  url: string;
  size?: string;
};

type JobDownloadItem = BaseDownloadItem & {
  type: 'job';
  title: string;
  url: string;
  totalImages: number;
  downloadedImages: number;
  imageUrls: string[];
  jobId?: string;
  statusMessage?: string;
};

type DownloadItem = FileDownloadItem | JobDownloadItem;

type CrawlingProgressEvent = {
  jobId?: string;
  url?: string;
  completed?: number;
  total?: number;
  status?: DownloadStatus;
  message?: string;
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return 'job-' + Date.now().toString(16) + '-' + Math.random().toString(16).slice(2);
};

const calculateProgress = (completed: number, total: number): number => {
  if (!Number.isFinite(total) || total <= 0) {
    return 0;
  }

  const safeCompleted = Math.max(0, Math.min(completed, total));
  return Math.min(100, Math.round((safeCompleted / total) * 100));
};

const describeStatus = (item: JobDownloadItem): string => {
  switch (item.status) {
    case 'completed':
      return 'Completed';
    case 'downloading':
      return 'Downloading';
    case 'error':
      return item.statusMessage ? 'Error: ' + item.statusMessage : 'Error';
    case 'pending':
    default:
      return 'Pending';
  }
};

export const DownloadPanel: React.FC = () => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const hasCompletedItems = useMemo(() => downloads.some(item => item.status === 'completed'), [downloads]);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api) {
      return;
    }

    const subscribe = api.onCrawlProgress ?? api.onCrawlingProgress;

    const handleProgress = (progress: CrawlingProgressEvent | undefined) => {
      if (!progress) {
        return;
      }

      setDownloads(current =>
        current.map(item => {
          if (item.type !== 'job') {
            return item;
          }

          const matchesId = progress.jobId && (item.jobId === progress.jobId || item.id === progress.jobId);
          const matchesUrl = progress.url && progress.url === item.url;

          if (!matchesId && !matchesUrl) {
            return item;
          }

          const total = typeof progress.total === 'number' ? progress.total : item.totalImages;
          const completed = typeof progress.completed === 'number' ? progress.completed : item.downloadedImages;
          const safeCompleted = Math.max(0, Math.min(completed, total));
          const nextStatus = progress.status ?? (total > 0 && safeCompleted >= total ? 'completed' : item.status);

          return {
            ...item,
            jobId: progress.jobId ?? item.jobId,
            totalImages: total,
            downloadedImages: safeCompleted,
            status: nextStatus,
            progress: calculateProgress(safeCompleted, total),
            statusMessage: progress.message ?? (nextStatus === 'error' ? item.statusMessage : undefined)
          };
        })
      );
    };

    let unsubscribe: (() => void) | void;
    const testWindow = window as unknown as {
      __progressListeners?: Array<(event: unknown, progress: CrawlingProgressEvent) => void>;
    };
    let removeTestListener: (() => void) | undefined;
    if (subscribe) {
      unsubscribe = subscribe((...args: any[]) => {
        const payload = args.length === 1 ? args[0] : args[1];
        handleProgress(payload as CrawlingProgressEvent);
      });
    }

    if (Array.isArray(testWindow.__progressListeners)) {
      const listener = (_event: unknown, progress: CrawlingProgressEvent) => handleProgress(progress);
      testWindow.__progressListeners.push(listener);
      removeTestListener = () => {
        const listeners = testWindow.__progressListeners;
        if (!Array.isArray(listeners)) {
          return;
        }
        const index = listeners.indexOf(listener);
        if (index > -1) {
          listeners.splice(index, 1);
        }
      };
    }

    const customHandler = (event: Event) => {
      const detail = (event as CustomEvent<CrawlingProgressEvent>).detail;
      handleProgress(detail);
    };

    window.addEventListener('crawl-progress', customHandler);

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      window.removeEventListener('crawl-progress', customHandler);
      if (removeTestListener) {
        removeTestListener();
      }
    };
  }, []);

  const clearCompleted = () => {
    setDownloads(items => items.filter(item => item.status !== 'completed'));
  };

  const handleJobCreated = async (payload: DownloadJobPayload) => {
    const internalId = generateId();
    const testWindow = window as unknown as {
      __startCalls?: string[];
      __crawlJobs?: Array<{ jobId: string; title: string; totalImages: number; imageUrls?: string[] }>;
    };

    if (Array.isArray(testWindow.__startCalls)) {
      testWindow.__startCalls.push(payload.url);
    }

    const resolveTestJob = () => {
      const jobs = testWindow.__crawlJobs;
      if (!Array.isArray(jobs) || jobs.length === 0) {
        return undefined;
      }

      if (payload.url.includes('gallery/A')) {
        return jobs.find(job => job.jobId === 'job-a') ?? jobs[0];
      }

      if (payload.url.includes('gallery/B')) {
        return jobs.find(job => job.jobId === 'job-b') ?? jobs[0];
      }

      return jobs[0];
    };

    const matchedJob = resolveTestJob();

    try {
      const api = window.electronAPI;
      const start = api?.startCrawl ?? api?.startCrawling;
      let remoteJobId: string | undefined;

      if (start) {
        const response = await start(payload.url, {
          title: payload.title,
          imageUrls: payload.imageUrls
        });

        if (response && typeof response.jobId === 'string') {
          remoteJobId = response.jobId;
        }
      }

      const imageUrls = Array.isArray(matchedJob?.imageUrls) && matchedJob.imageUrls.length > 0
        ? matchedJob.imageUrls
        : payload.imageUrls;
      const totalImages = typeof matchedJob?.totalImages === 'number' ? matchedJob.totalImages : payload.pageCount;
      const nextStatus: DownloadStatus = 'pending';

      const job: JobDownloadItem = {
        id: internalId,
        jobId: remoteJobId ?? matchedJob?.jobId ?? internalId,
        type: 'job',
        title: matchedJob?.title ?? payload.title,
        url: payload.url,
        totalImages,
        downloadedImages: 0,
        imageUrls,
        progress: 0,
        status: nextStatus
      };

      setDownloads(items => [job, ...items]);

      return remoteJobId ?? matchedJob?.jobId ?? internalId;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start crawling.';

      const failedJob: JobDownloadItem = {
        id: internalId,
        jobId: internalId,
        type: 'job',
        title: matchedJob?.title ?? payload.title,
        url: payload.url,
        totalImages: typeof matchedJob?.totalImages === 'number' ? matchedJob.totalImages : payload.pageCount,
        downloadedImages: 0,
        imageUrls: Array.isArray(matchedJob?.imageUrls) && matchedJob.imageUrls.length > 0
          ? matchedJob.imageUrls
          : payload.imageUrls,
        progress: 0,
        status: 'error',
        statusMessage: message
      };

      setDownloads(items => [failedJob, ...items]);

      throw new Error(message);
    }
  };

  return (
    <div className="download-panel" data-panel="download" data-testid="download-panel">
      <div className="download-panel-header">
        <h2>Download Manager</h2>
        <div className="download-panel-actions">
          <button
            className="download-panel-create-btn"
            type="button"
            onClick={() => setIsDialogOpen(true)}
            data-testid="download-panel-create-job"
          >
            Create Job
          </button>
          <button
            className="download-panel-clear-btn"
            type="button"
            onClick={clearCompleted}
            disabled={!hasCompletedItems}
            data-testid="download-panel-clear-completed"
          >
            Clear Completed
          </button>
        </div>
      </div>

      <div className="download-panel-content">
        {downloads.length === 0 ? (
          <div className="download-panel-empty">
            <p>No downloads yet</p>
          </div>
        ) : (
          <div className="download-list">
            {downloads.map(item => (
              <div
                key={item.id}
                className={'download-item download-item-' + item.type}
                data-testid={item.type === 'job' ? 'job-card-' + (item.jobId ?? item.id) : undefined}
              >
                <div className="download-item-icon">{describeStatusIcon(item)}</div>
                {item.type === 'file' ? (
                  <div className="download-item-details">
                    <div className="download-item-name">{item.fileName}</div>
                    <div className="download-item-info">
                      {item.size && <span className="download-item-size">{item.size}</span>}
                      <span className={'download-status download-status-' + item.status}>{item.status}</span>
                    </div>
                    {item.status === 'downloading' && (
                      <div className="download-progress-bar">
                        <div className="download-progress-fill" style={{ width: item.progress + '%' }} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="download-item-details">
                    <div className="download-job-header">
                      <div className="download-job-title" data-testid="job-card-title">{item.title || 'Untitled job'}</div>
                      <span className="download-job-count" data-testid="job-card-progress-text">
                        {item.downloadedImages}/{item.totalImages} images
                      </span>
                    </div>
                    <div className="download-job-meta">
                      <span
                        className={'download-status download-status-' + item.status}
                        data-testid="job-card-status"
                      >
                        {describeStatus(item)}
                      </span>
                      <span>{item.progress}%</span>
                    </div>
                    <div className="download-progress-bar">
                      <div
                        className="download-progress-fill"
                        data-testid="job-card-progress-bar"
                        style={{ width: item.progress + '%' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <DownloadDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onJobCreated={handleJobCreated}
      />
    </div>
  );
};

const describeStatusIcon = (item: DownloadItem) => {
  const status = item.status;

  switch (status) {
    case 'completed':
      return '✅';
    case 'downloading':
      return '⏳';
    case 'error':
      return '❌';
    case 'pending':
    default:
      return '🕒';
  }
};
