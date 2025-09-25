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
    };
  }
}
