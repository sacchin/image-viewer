import React from 'react';
import './FolderTree.css';

interface FolderTreeProps {
  onFolderSelect?: (folder: string) => void;
  works?: any[];
  selectedWork?: string | null;
  onSelect?: (workId: string) => void;
}

const FolderTree: React.FC<FolderTreeProps> = ({ onFolderSelect, works = [], selectedWork, onSelect }) => {
  const handleItemClick = (workId: string, workName: string) => {
    if (onFolderSelect) {
      onFolderSelect(workName);
    }
    if (onSelect) {
      onSelect(workId);
    }
  };
  return (
    <div className="folder-tree" data-testid="sidebar">
      <div className="folder-tree-header">
        <h3>Library</h3>
      </div>
      <div className="folder-tree-content" data-testid="folder-tree">
        {works.length === 0 ? (
          <div className="folder-tree-empty">
            <p>No works in library</p>
            <p className="folder-tree-hint">Use File → Import Folder to add content</p>
          </div>
        ) : (
          <ul className="folder-tree-list">
            {works.map((work: any) => (
              <li
                key={work.id}
                className={`folder-tree-item ${selectedWork === work.id ? 'selected' : ''}`}
                onClick={() => handleItemClick(work.id, work.name)}
              >
                {work.name}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};

export default FolderTree;