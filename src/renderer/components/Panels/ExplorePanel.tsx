import React, { useState } from 'react';
import FolderTree from '../FolderTree/FolderTree';
import ImageGrid from '../ImageGrid/ImageGrid';
import './ExplorePanel.css';

export const ExplorePanel: React.FC = () => {
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  return (
    <div className="explore-panel" data-panel="explore">
      <div className="explore-panel-sidebar">
        <FolderTree onFolderSelect={setSelectedFolder} />
      </div>
      <div className="explore-panel-content">
        <ImageGrid selectedFolder={selectedFolder} />
      </div>
    </div>
  );
};