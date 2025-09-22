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
      startCrawling: (url: string) => Promise<any>;
      cancelCrawling: () => Promise<any>;
      onCrawlingProgress: (callback: (progress: any) => void) => void;
    };
  }
}