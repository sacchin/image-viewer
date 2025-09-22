import React from 'react';
import './ImageGrid.css';

interface ImageGridProps {
  workId: string | null;
  viewMode: 'grid' | 'list';
}

const ImageGrid: React.FC<ImageGridProps> = ({ workId, viewMode }) => {
  if (!workId) {
    return (
      <div className="image-grid-empty">
        <p>Select a work from the library to view images</p>
      </div>
    );
  }

  return (
    <div className={`image-grid ${viewMode}`}>
      <div className="image-grid-placeholder">
        <p>Images for {workId} will appear here</p>
        <p className="image-grid-hint">View mode: {viewMode}</p>
      </div>
    </div>
  );
};

export default ImageGrid;