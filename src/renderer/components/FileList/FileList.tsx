import React, { useState, useEffect, useRef } from 'react';
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
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (folderPath) {
      loadFolderContents(folderPath);
    } else {
      setFiles([]);
    }
  }, [folderPath]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (files.length === 0) return;

      let newIndex = selectedIndex;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        newIndex = selectedIndex < files.length - 1 ? selectedIndex + 1 : selectedIndex;
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        newIndex = selectedIndex > 0 ? selectedIndex - 1 : 0;
      } else if (e.key === 'Enter' && selectedIndex >= 0 && selectedIndex < files.length) {
        e.preventDefault();
        const file = files[selectedIndex];
        handleFileClick(file);
        return;
      } else {
        return;
      }

      if (newIndex !== selectedIndex && newIndex >= 0 && newIndex < files.length) {
        setSelectedIndex(newIndex);
        const file = files[newIndex];
        setSelectedFile(file.path);
        onFileSelect(file); // 上下キーで選択されたファイルをプレビュー

        // Scroll to the selected item
        const fileListElement = listRef.current?.querySelector('.file-list');
        const selectedElement = fileListElement?.children[newIndex] as HTMLElement;
        if (selectedElement) {
          selectedElement.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    };

    // Add event listener only when the file list has focus
    const container = listRef.current;
    if (container) {
      container.addEventListener('keydown', handleKeyDown);
      return () => {
        container.removeEventListener('keydown', handleKeyDown);
      };
    }
  }, [files, selectedIndex, onFileSelect]);

  const loadFolderContents = async (path: string) => {
    setLoading(true);
    try {
      const contents = await window.electronAPI.getFolderContents(path);
      setFiles(contents);
      setSelectedFile(null);
      setSelectedIndex(-1);
    } catch (error) {
      console.error('Failed to load folder contents:', error);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  const handleFileClick = (file: FileItem, index?: number) => {
    setSelectedFile(file.path);
    if (index !== undefined) {
      setSelectedIndex(index);
    }
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
    <div className="file-list-container" ref={listRef} tabIndex={0}>
      <div className="file-list-header">
        <span className="file-count">{files.length} images</span>
      </div>
      <div className="file-list">
        {files.map((file, index) => (
          <div
            key={file.path}
            className={`file-list-item ${selectedFile === file.path ? 'selected' : ''}`}
            onClick={() => handleFileClick(file, index)}
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