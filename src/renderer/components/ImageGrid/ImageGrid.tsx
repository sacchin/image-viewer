import React from 'react';
import './ImageGrid.css';

interface ImageGridProps {
  selectedFolder?: string | null;
  workId?: string | null;
  viewMode?: 'grid' | 'list';
}

const ImageGrid: React.FC<ImageGridProps> = ({ selectedFolder, workId, viewMode = 'grid' }) => {
  const displayId = selectedFolder || workId;

  if (!displayId) {
    return (
      <div className="image-grid-empty" data-testid="image-grid">
        <div data-testid="empty-state">
          <p>Select a work from the library to view images</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`image-grid ${viewMode}`} data-testid="image-grid">
      <div className="image-grid-placeholder">
        <p>Images for {displayId} will appear here</p>
        <p className="image-grid-hint">View mode: {viewMode}</p>
      </div>
    </div>
  );
};

export default ImageGrid;