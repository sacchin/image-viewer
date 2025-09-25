import React, { useState, useEffect } from 'react';
import './FileList.css';

interface FileItem {
  name: string;
  path: string;
  type: string;
  size: number;
  modified: Date;
}

interface FileListProps {
  folderPath: string | null;
  onFileSelect: (file: FileItem) => void;
}

const FileList: React.FC<FileListProps> = ({ folderPath, onFileSelect }) => {
  const [files, setFiles] = useState<FileItem[]>([]);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (folderPath) {
      loadFolderContents(folderPath);
    } else {
      setFiles([]);
    }
  }, [folderPath]);

  const loadFolderContents = async (path: string) => {
    setLoading(true);
    try {
      const contents = await window.electronAPI.getFolderContents(path);
      setFiles(contents);
      setSelectedFile(null);
    } catch (error) {
      console.error('Failed to load folder contents:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = (file: FileItem) => {
    setSelectedFile(file.path);
    onFileSelect(file);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  const formatDate = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="file-list-container">
        <div className="file-list-loading">Loading...</div>
      </div>
    );
  }

  if (!folderPath) {
    return (
      <div className="file-list-container">
        <div className="file-list-empty">Select a folder to view images</div>
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="file-list-container">
        <div className="file-list-empty">No images found in this folder</div>
      </div>
    );
  }

  return (
    <div className="file-list-container">
      <div className="file-list-header">
        <span className="file-count">{files.length} images</span>
      </div>
      <div className="file-list">
        {files.map((file) => (
          <div
            key={file.path}
            className={`file-list-item ${selectedFile === file.path ? 'selected' : ''}`}
            onClick={() => handleFileClick(file)}
            title={file.name}
          >
            <div className="file-icon">📷</div>
            <div className="file-info">
              <div className="file-name">{file.name}</div>
              <div className="file-details">
                <span className="file-size">{formatFileSize(file.size)}</span>
                <span className="file-date">{formatDate(file.modified)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileList;