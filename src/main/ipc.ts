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

// Helper function to sanitize folder names for file system
function sanitizeFolderName(title: string): string {
  // Replace Windows forbidden characters
  let safe = title.replace(/[<>:"/\\|?*]/g, '_');
  // Replace consecutive spaces or underscores with single underscore
  safe = safe.replace(/[\s_]+/g, '_');
  // Remove leading/trailing whitespace and dots
  safe = safe.trim().replace(/^\.+|\.+$/g, '');
  // Limit length to 200 characters
  if (safe.length > 200) {
    safe = safe.substring(0, 200);
  }
  // Fallback if empty
  return safe || `gallery_${Date.now()}`;
}

// Helper function to get next available file number in directory
async function getNextFileNumber(dirPath: string): Promise<number> {
  try {
    const files = await fsPromises.readdir(dirPath);
    const numbers = files
      .map(file => {
        const match = file.match(/^(\d+)\.[^.]+$/);
        return match ? parseInt(match[1], 10) : 0;
      })
      .filter(num => !isNaN(num));

    return numbers.length > 0 ? Math.max(...numbers) + 1 : 1;
  } catch (error) {
    return 1;
  }
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

  // Get starting file number for existing directory
  let fileNumber = await getNextFileNumber(job.outputDir);

  // Download images
  for (let i = 0; i < job.imageUrls.length; i++) {
    if (job.cancelled) {
      job.status = 'error';
      sendProgressUpdate(mainWindow, job, 'Download cancelled');
      return;
    }

    const imageUrl = job.imageUrls[i];
    const ext = path.extname(new URL(imageUrl).pathname) || '.jpg';
    const filename = `${String(fileNumber).padStart(3, '0')}${ext}`;
    const outputPath = path.join(job.outputDir, filename);

    try {
      await downloadImage(imageUrl, outputPath);
      job.completed++;
      fileNumber++;
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

    // Create download directory using settings and title-based folder name
    const downloadPath = settingsManager.getSettings().defaultDownloadPath;
    const safeFolderName = sanitizeFolderName(data?.title || 'Untitled');
    const jobDir = path.join(downloadPath, safeFolderName);

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

  // Folder and file operations for image exploration
  ipcMain.handle('read-folder-tree', async (_, folderPath: string) => {
    try {
      const stats = await fsPromises.stat(folderPath);
      if (!stats.isDirectory()) {
        return null;
      }

      const readDirRecursive = async (dirPath: string, depth: number = 0, maxDepth: number = 10): Promise<any> => {
        const name = path.basename(dirPath);
        const item: any = {
          name,
          path: dirPath,
          type: 'folder',
          children: []
        };

        if (depth < maxDepth) {
          try {
            const files = await fsPromises.readdir(dirPath);
            for (const file of files) {
              const filePath = path.join(dirPath, file);
              try {
                const fileStat = await fsPromises.stat(filePath);
                if (fileStat.isDirectory()) {
                  // Recursively read subdirectories
                  const child = await readDirRecursive(filePath, depth + 1, maxDepth);
                  item.children.push(child);
                }
              } catch (err) {
                // Skip files/folders we can't access
                console.warn(`Cannot access ${filePath}:`, err);
              }
            }
          } catch (err) {
            console.warn(`Cannot read directory ${dirPath}:`, err);
          }
        }

        return item;
      };

      return await readDirRecursive(folderPath);
    } catch (error) {
      console.error('Error reading folder tree:', error);
      return null;
    }
  });

  ipcMain.handle('get-folder-contents', async (_, folderPath: string) => {
    try {
      const files = await fsPromises.readdir(folderPath);
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];
      const contents = [];

      for (const file of files) {
        const filePath = path.join(folderPath, file);
        try {
          const stats = await fsPromises.stat(filePath);
          const ext = path.extname(file).toLowerCase();

          if (stats.isFile() && imageExtensions.includes(ext)) {
            contents.push({
              name: file,
              path: filePath,
              type: 'image',
              size: stats.size,
              modified: stats.mtime
            });
          }
        } catch (err) {
          console.warn(`Cannot access ${filePath}:`, err);
        }
      }

      // Sort by name
      contents.sort((a, b) => a.name.localeCompare(b.name));

      return contents;
    } catch (error) {
      console.error('Error getting folder contents:', error);
      return [];
    }
  });

  ipcMain.handle('read-image-file', async (_, imagePath: string) => {
    try {
      const data = await fsPromises.readFile(imagePath);
      const ext = path.extname(imagePath).toLowerCase();

      // Determine MIME type
      const mimeTypes: { [key: string]: string } = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.bmp': 'image/bmp',
        '.webp': 'image/webp',
        '.svg': 'image/svg+xml'
      };

      const mimeType = mimeTypes[ext] || 'image/jpeg';
      const base64 = data.toString('base64');

      return {
        data: `data:${mimeType};base64,${base64}`,
        size: data.length,
        type: mimeType
      };
    } catch (error) {
      console.error('Error reading image file:', error);
      return null;
    }
  });
}
