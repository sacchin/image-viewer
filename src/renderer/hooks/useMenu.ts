import { useEffect } from 'react';

interface UseMenuOptions {
  onNewDownload?: () => void;
  onImportFolder?: () => void;
  onOpenFolder?: () => void;
  onViewChange?: (mode: 'grid' | 'list') => void;
  onRefresh?: () => void;
  onManageTags?: () => void;
  onSearch?: () => void;
}

export function useMenu(options: UseMenuOptions) {
  useEffect(() => {
    const handleMenuAction = (action: string) => {
      switch (action) {
        case 'new-download':
          options.onNewDownload?.();
          break;
        case 'import-folder':
          options.onImportFolder?.();
          break;
        case 'open-folder':
          options.onOpenFolder?.();
          break;
        case 'view-grid':
          options.onViewChange?.('grid');
          break;
        case 'view-list':
          options.onViewChange?.('list');
          break;
        case 'refresh-library':
          options.onRefresh?.();
          break;
        case 'manage-tags':
          options.onManageTags?.();
          break;
        case 'search':
          options.onSearch?.();
          break;
      }
    };

    window.electronAPI.onMenuAction(handleMenuAction);
  }, [options]);
}