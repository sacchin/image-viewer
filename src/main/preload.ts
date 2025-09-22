import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Menu actions
  onMenuAction: (callback: (action: string) => void) => {
    ipcRenderer.on('menu-action', (_, action) => callback(action));
  },

  // File operations
  selectDirectory: () => ipcRenderer.invoke('select-directory'),
  readLibrary: () => ipcRenderer.invoke('read-library'),
  saveMetadata: (workId: string, metadata: any) =>
    ipcRenderer.invoke('save-metadata', workId, metadata),

  // Crawler operations
  startCrawling: (url: string) => ipcRenderer.invoke('start-crawling', url),
  cancelCrawling: () => ipcRenderer.invoke('cancel-crawling'),
  onCrawlingProgress: (callback: (progress: any) => void) => {
    ipcRenderer.on('crawling-progress', (_, progress) => callback(progress));
  }
});