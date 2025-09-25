import { ipcMain, dialog, BrowserWindow } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { promises as fsPromises } from 'fs';
import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { settingsManager } from './settings';

// Download job tracking
interface DownloadJob {
  jobId: string;
  url: string;
  title: string;
  imageUrls: string[];
  status: 'pending' | 'downloading' | 'completed' | 'error';
  completed: number;
  total: number;
  outputDir: string;
  cancelled?: boolean;
}

const downloadJobs = new Map<string, DownloadJob>();
let jobCounter = 0;

// Helper function to download an image
async function downloadImage(url: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;

      const file = fs.createWriteStream(outputPath);

      const request = protocol.get(url, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          // Handle redirect
          file.close();
          if (response.headers.location) {
            downloadImage(response.headers.location, outputPath)
              .then(resolve)
              .catch(reject);
          } else {
            reject(new Error('Redirect without location header'));
          }
          return;
        }

        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(outputPath);
          reject(new Error(`Failed to download: HTTP ${response.statusCode}`));
          return;
        }

        response.pipe(file);

        file.on('finish', () => {
          file.close();
          resolve();
        });
      });

      request.on('error', (err) => {
        file.close();
        fs.unlinkSync(outputPath);
        reject(err);
      });

      request.setTimeout(30000, () => {
        request.destroy();
        file.close();
        fs.unlinkSync(outputPath);
        reject(new Error('Download timeout'));
      });
    } catch (error) {
      reject(error);
    }
  });
}

// Helper function to send progress updates
function sendProgressUpdate(mainWindow: BrowserWindow | null, job: DownloadJob, message?: string) {
  if (!mainWindow) return;

  mainWindow.webContents.send('crawling-progress', {
    jobId: job.jobId,
    url: job.url,
    completed: job.completed,
    total: job.total,
    status: job.status,
    message: message
  });
}

// Background download function
async function processDownloadJob(jobId: string, mainWindow: BrowserWindow | null) {
  const job = downloadJobs.get(jobId);
  if (!job) return;

  job.status = 'downloading';
  sendProgressUpdate(mainWindow, job);

  // Create output directory if it doesn't exist
  try {
    await fsPromises.mkdir(job.outputDir, { recursive: true });
  } catch (error) {
    job.status = 'error';
    sendProgressUpdate(mainWindow, job, `Failed to create output directory: ${error}`);
    return;
  }

  // Download images
  for (let i = 0; i < job.imageUrls.length; i++) {
    if (job.cancelled) {
      job.status = 'error';
      sendProgressUpdate(mainWindow, job, 'Download cancelled');
      return;
    }

    const imageUrl = job.imageUrls[i];
    const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const filename = `${job.title.replace(/[^a-z0-9]/gi, '_')}_${String(i + 1).padStart(3, '0')}${ext}`;
    const outputPath = path.join(job.outputDir, filename);

    try {
      await downloadImage(imageUrl, outputPath);
      job.completed++;
      sendProgressUpdate(mainWindow, job);
    } catch (error) {
      console.error(`Failed to download image ${i + 1}:`, error);
      // Continue with next image even if one fails
    }
  }

  job.status = job.completed === job.total ? 'completed' : 'error';
  sendProgressUpdate(mainWindow, job,
    job.status === 'completed' ? 'Download completed' : `Downloaded ${job.completed}/${job.total} images`);
}

export function setupIpcHandlers(): void {
  // Get main window reference
  const getMainWindow = () => {
    const windows = BrowserWindow.getAllWindows();
    return windows.length > 0 ? windows[0] : null;
  };
  // Directory selection
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory']
    });

    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  });

  // Library operations
  ipcMain.handle('read-library', async () => {
    // TODO: Implement library reading logic
    const libraryPath = path.join(process.cwd(), 'library');

    if (!fs.existsSync(libraryPath)) {
      fs.mkdirSync(libraryPath, { recursive: true });
    }

    return [];
  });

  // Metadata operations
  ipcMain.handle('save-metadata', async (_, workId: string, metadata: any) => {
    // TODO: Implement metadata saving logic
    console.log('Saving metadata for:', workId, metadata);
    return true;
  });

  // Crawler operations
  ipcMain.handle('start-crawling', async (_, url: string, data?: any) => {
    // Generate job ID
    const jobId = `job-${Date.now()}-${++jobCounter}`;

    // Create download directory using settings
    const downloadPath = settingsManager.getSettings().defaultDownloadPath;
    const jobDir = path.join(downloadPath, jobId);

    // Create job
    const job: DownloadJob = {
      jobId,
      url,
      title: data?.title || 'Untitled',
      imageUrls: data?.imageUrls || [],
      status: 'pending',
      completed: 0,
      total: data?.imageUrls?.length || 0,
      outputDir: jobDir
    };

    downloadJobs.set(jobId, job);

    // Start download in background
    const mainWindow = getMainWindow();
    setTimeout(() => {
      processDownloadJob(jobId, mainWindow);
    }, 100);

    return { jobId, status: 'started', url };
  });

  ipcMain.handle('cancel-crawling', async (_, jobId?: string) => {
    if (jobId) {
      const job = downloadJobs.get(jobId);
      if (job) {
        job.cancelled = true;
        return { status: 'cancelled', jobId };
      }
    }

    // Cancel all jobs
    downloadJobs.forEach(job => {
      job.cancelled = true;
    });

    return { status: 'cancelled' };
  });

  // Fetch URL from main process to avoid CORS issues
  ipcMain.handle('fetch-url', async (_, url: string) => {
    try {
      const response = await fetch(url, { method: 'GET' });

      if (!response.ok) {
        throw new Error(`Failed to fetch page (status ${response.status})`);
      }

      const html = await response.text();
      return { success: true, html };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error occurred while fetching';
      return { success: false, error: message };
    }
  });

  // Settings operations
  ipcMain.handle('get-settings', async () => {
    return settingsManager.getSettings();
  });

  ipcMain.handle('save-settings', async (_, settings: any) => {
    settingsManager.saveSettings(settings);
    return { success: true };
  });

  ipcMain.handle('reset-settings', async () => {
    settingsManager.resetToDefaults();
    return settingsManager.getSettings();
  });

  ipcMain.handle('get-default-settings', async () => {
    return {
      defaultDownloadPath: settingsManager.getDefaultDownloadPath()
    };
  });
}
