import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // File operations
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  readLibrary: () => ipcRenderer.invoke('read-library'),
  saveMetadata: (workId: string, metadata: any) =>
    ipcRenderer.invoke('save-metadata', workId, metadata),

  // Crawler operations
  startCrawl: (url: string, data?: any) => ipcRenderer.invoke('start-crawling', url, data),
  startCrawling: (url: string, data?: any) => ipcRenderer.invoke('start-crawling', url, data),
  cancelCrawling: (jobId?: string) => ipcRenderer.invoke('cancel-crawling', jobId),
  onCrawlingProgress: (callback: (progress: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, progress: any) => callback(progress);
    ipcRenderer.on('crawling-progress', handler);
    return () => ipcRenderer.off('crawling-progress', handler);
  },
  onCrawlProgress: (callback: (progress: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, progress: any) => callback(progress);
    ipcRenderer.on('crawling-progress', handler);
    return () => ipcRenderer.off('crawling-progress', handler);
  },

  // Fetch URL from main process to avoid CORS issues
  fetchUrl: (url: string) => ipcRenderer.invoke('fetch-url', url),

  // Settings operations
  getSettings: () => ipcRenderer.invoke('get-settings'),
  saveSettings: (settings: any) => ipcRenderer.invoke('save-settings', settings),
  resetSettings: () => ipcRenderer.invoke('reset-settings'),
  getDefaultSettings: () => ipcRenderer.invoke('get-default-settings'),

  // Folder and image operations
  readFolderTree: (folderPath: string) => ipcRenderer.invoke('read-folder-tree', folderPath),
  readSubfolders: (folderPath: string) => ipcRenderer.invoke('read-subfolders', folderPath),
  getFolderContents: (folderPath: string) => ipcRenderer.invoke('get-folder-contents', folderPath),
  readImageFile: (imagePath: string) => ipcRenderer.invoke('read-image-file', imagePath)
});
