import React, { useState, useEffect } from 'react';
import FolderTree from '../FolderTree/FolderTree';
import FileList from '../FileList/FileList';
import ImagePreview from '../ImagePreview/ImagePreview';
import './ExplorePanel.css';

interface ExplorePanelProps {
  selectedFolderPath?: string | null;
}

export const ExplorePanel: React.FC<ExplorePanelProps> = ({ selectedFolderPath }) => {
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

  useEffect(() => {
    // Update root path when a folder is selected from menu
    if (selectedFolderPath) {
      setRootPath(selectedFolderPath);
      setSelectedFolder(selectedFolderPath);
    }
  }, [selectedFolderPath]);

  const handleFolderSelect = (folderPath: string) => {
    setSelectedFolder(folderPath);
    setSelectedFile(null); // Clear selected file when folder changes
  };

  const handleSelectFolder = async () => {
    const folderPath = await window.electronAPI.selectDirectory();
    if (folderPath) {
      setRootPath(folderPath);
      setSelectedFolder(folderPath);
    }
  };

  const handleFileSelect = (file: any) => {
    setSelectedFile(file.path);
  };

  return (
    <div className="explore-panel" data-panel="explore">
      <div className="explore-panel-sidebar">
        <div className="explore-panel-toolbar">
          <button
            className="open-folder-button"
            onClick={handleSelectFolder}
            title="Open Folder"
          >
            📁 Open Folder
          </button>
          {rootPath && (
            <div className="current-path" title={rootPath}>
              {rootPath}
            </div>
          )}
        </div>
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