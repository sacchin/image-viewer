import React, { useState } from 'react';
import './DownloadPanel.css';

interface DownloadItem {
  id: string;
  fileName: string;
  url: string;
  progress: number;
  status: 'pending' | 'downloading' | 'completed' | 'error';
  size?: string;
}

export const DownloadPanel: React.FC = () => {
  const [downloads, setDownloads] = useState<DownloadItem[]>([
    {
      id: '1',
      fileName: 'sample-image-1.jpg',
      url: 'https://example.com/image1.jpg',
      progress: 100,
      status: 'completed',
      size: '2.5 MB'
    },
    {
      id: '2',
      fileName: 'sample-image-2.png',
      url: 'https://example.com/image2.png',
      progress: 45,
      status: 'downloading',
      size: '1.8 MB'
    }
  ]);

  const getStatusIcon = (status: DownloadItem['status']) => {
    switch (status) {
      case 'completed':
        return '✅';
      case 'downloading':
        return '⏳';
      case 'error':
        return '❌';
      default:
        return '⏸';
    }
  };

  const clearCompleted = () => {
    setDownloads(downloads.filter(d => d.status !== 'completed'));
  };

  return (
    <div className="download-panel" data-panel="download">
      <div className="download-panel-header">
        <h2>Download Manager</h2>
        <button
          className="download-panel-clear-btn"
          onClick={clearCompleted}
        >
          Clear Completed
        </button>
      </div>

      <div className="download-panel-content">
        {downloads.length === 0 ? (
          <div className="download-panel-empty">
            <p>No downloads yet</p>
          </div>
        ) : (
          <div className="download-list">
            {downloads.map(item => (
              <div key={item.id} className="download-item">
                <div className="download-item-icon">
                  {getStatusIcon(item.status)}
                </div>
                <div className="download-item-details">
                  <div className="download-item-name">{item.fileName}</div>
                  <div className="download-item-info">
                    {item.size && <span className="download-item-size">{item.size}</span>}
                    {item.status === 'downloading' && (
                      <span className="download-item-progress">{item.progress}%</span>
                    )}
                  </div>
                  {item.status === 'downloading' && (
                    <div className="download-progress-bar">
                      <div
                        className="download-progress-fill"
                        style={{ width: `${item.progress}%` }}
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};