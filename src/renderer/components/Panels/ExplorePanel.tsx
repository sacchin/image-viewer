import React, { useState, useEffect } from 'react';
import FolderTree from '../FolderTree/FolderTree';
import FileList from '../FileList/FileList';
import ImagePreview from '../ImagePreview/ImagePreview';
import './ExplorePanel.css';

export const ExplorePanel: React.FC = () => {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [rootPath, setRootPath] = useState<string>('');

  useEffect(() => {
    // Get initial root path from settings
    window.electronAPI.getSettings().then((settings: any) => {
      if (settings?.defaultDownloadPath) {
        setRootPath(settings.defaultDownloadPath);
      }
    });
  }, []);

  const handleFolderSelect = (folderPath: string) => {
    setSelectedFolder(folderPath);
    setSelectedFile(null); // Clear selected file when folder changes
  };

  const handleFileSelect = (file: any) => {
    setSelectedFile(file.path);
  };

  return (
    <div className="explore-panel" data-panel="explore">
      <div className="explore-panel-sidebar">
        <div className="explore-panel-sidebar-top">
          <FolderTree
            rootPath={rootPath}
            onFolderSelect={handleFolderSelect}
          />
        </div>
        <div className="explore-panel-sidebar-bottom">
          <FileList
            folderPath={selectedFolder}
            onFileSelect={handleFileSelect}
          />
        </div>
      </div>
      <div className="explore-panel-content">
        <ImagePreview imagePath={selectedFile} />
      </div>
    </div>
  );
};