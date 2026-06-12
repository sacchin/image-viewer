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

// Extensions accepted both when listing folders and when naming downloads
const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'];

const MAX_REDIRECTS = 5;

// Helper function to download an image
async function downloadImage(url: string, outputPath: string, redirectCount: number = 0): Promise<void> {
  return new Promise((resolve, reject) => {
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      reject(new Error(`Invalid image URL: ${url}`));
      return;
    }

    if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
      reject(new Error(`Unsupported protocol: ${parsedUrl.protocol}`));
      return;
    }

    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    // Replaced once a 200 response opens the output file, so request-level
    // errors (e.g. timeout mid-transfer) also clean up the partial file
    let onRequestError: (err: Error) => void = reject;

    const request = protocol.get(url, (response) => {
      const status = response.statusCode ?? 0;

      if (status >= 300 && status < 400) {
        response.resume();
        const location = response.headers.location;
        if (!location) {
          reject(new Error('Redirect without location header'));
          return;
        }
        if (redirectCount >= MAX_REDIRECTS) {
          reject(new Error(`Too many redirects for ${url}`));
          return;
        }
        let redirectUrl: string;
        try {
          // Location may be relative — resolve it against the current URL
          redirectUrl = new URL(location, url).toString();
        } catch {
          reject(new Error(`Invalid redirect location: ${location}`));
          return;
        }
        downloadImage(redirectUrl, outputPath, redirectCount + 1).then(resolve).catch(reject);
        return;
      }

      if (status !== 200) {
        response.resume();
        reject(new Error(`Failed to download: HTTP ${status}`));
        return;
      }

      // Create the file only after a successful response so failed
      // requests never leave empty files behind
      const file = fs.createWriteStream(outputPath);
      let settled = false;

      const fail = (err: Error) => {
        if (settled) return;
        settled = true;
        // Wait for the handle to close before unlinking — unlinking an
        // open file fails on Windows. Unlink errors are secondary.
        file.close(() => {
          fs.unlink(outputPath, () => reject(err));
        });
      };

      onRequestError = fail;
      response.on('error', fail);
      file.on('error', fail);
      file.on('finish', () => {
        file.close((closeErr) => {
          if (settled) return;
          settled = true;
          if (closeErr) {
            fs.unlink(outputPath, () => reject(closeErr));
          } else {
            resolve();
          }
        });
      });

      response.pipe(file);
    });

    request.on('error', (err) => onRequestError(err));

    request.setTimeout(30000, () => {
      request.destroy(new Error('Download timeout'));
    });
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

// Helper function for natural sorting (numeric-aware sorting)
function naturalSort(a: string, b: string): number {
  // Split strings into parts of numbers and non-numbers
  const regex = /(\d+)|(\D+)/g;
  const aParts = a.match(regex) || [];
  const bParts = b.match(regex) || [];

  // Compare each part
  for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
    // If one string has fewer parts, it comes first
    if (!aParts[i]) return -1;
    if (!bParts[i]) return 1;

    const aIsNum = /^\d+$/.test(aParts[i]);
    const bIsNum = /^\d+$/.test(bParts[i]);

    if (aIsNum && bIsNum) {
      // Both parts are numbers, compare numerically
      const diff = parseInt(aParts[i], 10) - parseInt(bParts[i], 10);
      if (diff !== 0) return diff;
    } else {
      // At least one part is not a number, compare as strings
      const diff = aParts[i].localeCompare(bParts[i]);
      if (diff !== 0) return diff;
    }
  }

  return 0;
}

// Folder tree node returned to the renderer; children are loaded lazily
// (one level per request) so large or slow network folders stay responsive
interface FolderTreeNode {
  name: string;
  path: string;
  type: 'folder';
  children: FolderTreeNode[] | null;
  loaded: boolean;
}

// Read one level of subfolders. Uses withFileTypes so a single readdir
// call is enough — no per-entry stat, which is what made UNC paths slow.
async function readSubfolders(dirPath: string): Promise<FolderTreeNode[]> {
  try {
    const entries = await fsPromises.readdir(dirPath, { withFileTypes: true });
    return entries
      .filter(entry => entry.isDirectory())
      .map(entry => ({
        name: entry.name,
        path: path.join(dirPath, entry.name),
        type: 'folder' as const,
        children: null,
        loaded: false
      }));
  } catch (err) {
    console.warn(`Cannot read directory ${dirPath}:`, err);
    return [];
  }
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

  if (job.imageUrls.length === 0) {
    job.status = 'error';
    sendProgressUpdate(mainWindow, job, 'No image URLs to download');
    return;
  }

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

    // Name files only with known image extensions — never trust the URL
    // to pick arbitrary extensions (.exe, .html, ...) for files on disk
    let ext = '.jpg';
    try {
      const urlExt = path.extname(new URL(imageUrl).pathname).toLowerCase();
      if (IMAGE_EXTENSIONS.includes(urlExt)) {
        ext = urlExt;
      }
    } catch {
      // Invalid URL — downloadImage below will reject and the job moves on
    }

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
  // Directory selection with network folder support
  ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory'],
      title: 'Select Folder (Network folders supported)',
      buttonLabel: 'Select Folder'
    });

    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];

      // Validate the path exists and is accessible
      try {
        await fsPromises.access(selectedPath, fs.constants.R_OK);
        return selectedPath;
      } catch (error) {
        console.error('Cannot access selected directory:', error);
        // Still return the path, let the UI handle the error
        return selectedPath;
      }
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
      processDownloadJob(jobId, mainWindow).catch((error) => {
        console.error(`Download job ${jobId} failed:`, error);
      });
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

  // Folder and file operations for image exploration (with network support)
  // Returns the root node with only its first level of children;
  // deeper levels are fetched on demand via 'read-subfolders'.
  ipcMain.handle('read-folder-tree', async (_, folderPath: string) => {
    try {
      // Support for UNC paths and network drives
      const stats = await fsPromises.stat(folderPath).catch(err => {
        console.error(`Error accessing folder ${folderPath}:`, err);
        throw err;
      });

      if (!stats.isDirectory()) {
        return null;
      }

      const root: FolderTreeNode = {
        // basename is empty for drive roots like 'C:\' — fall back to the path
        name: path.basename(folderPath) || folderPath,
        path: folderPath,
        type: 'folder',
        children: await readSubfolders(folderPath),
        loaded: true
      };

      return root;
    } catch (error) {
      console.error('Error reading folder tree:', error);
      return null;
    }
  });

  // Lazily load one level of subfolders for tree expansion
  ipcMain.handle('read-subfolders', async (_, folderPath: string) => {
    return readSubfolders(folderPath);
  });

  ipcMain.handle('get-folder-contents', async (_, folderPath: string) => {
    try {
      const entries = await fsPromises.readdir(folderPath, { withFileTypes: true });

      // Filter by dirent type first so only image files get stat'ed,
      // then stat them concurrently (libuv throttles the actual parallelism)
      const imageEntries = entries.filter(
        entry => entry.isFile() && IMAGE_EXTENSIONS.includes(path.extname(entry.name).toLowerCase())
      );

      const contents = await Promise.all(
        imageEntries.map(async entry => {
          const filePath = path.join(folderPath, entry.name);
          try {
            const stats = await fsPromises.stat(filePath);
            return {
              name: entry.name,
              path: filePath,
              type: 'image',
              size: stats.size,
              modified: stats.mtime
            };
          } catch (err) {
            console.warn(`Cannot access ${filePath}:`, err);
            return null;
          }
        })
      );

      // Sort by name using natural sort (numeric-aware)
      return contents
        .filter((item): item is NonNullable<typeof item> => item !== null)
        .sort((a, b) => naturalSort(a.name, b.name));
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
