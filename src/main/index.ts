import { app, BrowserWindow, Menu } from 'electron';
import * as path from 'path';
import { setupIpcHandlers } from './ipc';
import { handleGalleryImageProtocol, registerGalleryImageScheme } from './external/imageProtocol';
import { getExternalFetcher } from './external';

let mainWindow: BrowserWindow | null = null;

// Custom schemes must be declared before the app is ready
registerGalleryImageScheme();

// Guard with isPackaged so a stray NODE_ENV on a user's machine can't make
// the packaged exe load the dev server
const isDev = process.env.NODE_ENV === 'development' && !app.isPackaged;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      // The renderer parses untrusted HTML from the external site, so it runs
      // in the OS sandbox; the preload only needs contextBridge/ipcRenderer
      sandbox: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // The renderer never legitimately opens new windows or navigates away
  // from the app, so block both (preload APIs must not leak to other pages)
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const isReload = url === mainWindow?.webContents.getURL();
    const isDevServer = isDev && url.startsWith('http://localhost:8080');
    if (!isReload && !isDevServer) {
      event.preventDefault();
    }
  });

  // Load the app
  if (isDev) {
    mainWindow.loadURL('http://localhost:8080');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
  }

  // Remove menu bar
  Menu.setApplicationMenu(null);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  // Images from the external site reach the renderer only through this
  // scheme, after allow-listing and content sniffing in the main process
  handleGalleryImageProtocol(getExternalFetcher);
  createWindow();
  setupIpcHandlers();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});