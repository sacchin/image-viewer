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
  startCrawl: (url: string, data?: any) => ipcRenderer.invoke('start-crawling', url, data),
  startCrawling: (url: string, data?: any) => ipcRenderer.invoke('start-crawling', url, data),
  cancelCrawling: () => ipcRenderer.invoke('cancel-crawling'),
  onCrawlingProgress: (callback: (progress: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, progress: any) => callback(progress);
    ipcRenderer.on('crawling-progress', handler);
    return () => ipcRenderer.off('crawling-progress', handler);
  },
  onCrawlProgress: (callback: (progress: any) => void) => {
    const handler = (_: Electron.IpcRendererEvent, progress: any) => callback(progress);
    ipcRenderer.on('crawling-progress', handler);
    return () => ipcRenderer.off('crawling-progress', handler);
  }
});
