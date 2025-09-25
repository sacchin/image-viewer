export {};

declare global {
  interface Window {
    electronAPI: {
      // Menu actions
      onMenuAction: (callback: (action: string) => void) => void;

      // File operations
      selectDirectory: () => Promise<string | null>;
      readLibrary: () => Promise<any[]>;
      saveMetadata: (workId: string, metadata: any) => Promise<boolean>;

      // Crawler operations
      startCrawl?: (url: string, data?: any) => Promise<any>;
      startCrawling: (url: string) => Promise<any>;
      cancelCrawling: () => Promise<any>;
      onCrawlProgress?: (callback: (progress: any) => void) => void | (() => void);
      onCrawlingProgress: (callback: (progress: any) => void) => void;

      // Fetch URL from main process to avoid CORS issues
      fetchUrl: (url: string) => Promise<{ success: boolean; html?: string; error?: string }>;

      // Settings operations
      getSettings: () => Promise<any>;
      saveSettings: (settings: any) => Promise<{ success: boolean }>;
      resetSettings: () => Promise<any>;
      getDefaultSettings: () => Promise<any>;

      // Folder and image operations
      readFolderTree: (folderPath: string) => Promise<any>;
      getFolderContents: (folderPath: string) => Promise<any[]>;
      readImageFile: (imagePath: string) => Promise<{ data: string; size: number; type: string } | null>;
    };
  }
}
