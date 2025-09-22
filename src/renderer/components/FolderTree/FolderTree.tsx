import React from 'react';
import './FolderTree.css';

interface FolderTreeProps {
  works: any[];
  selectedWork: string | null;
  onSelect: (workId: string) => void;
}

const FolderTree: React.FC<FolderTreeProps> = ({ works, selectedWork, onSelect }) => {
  return (
    <div className="folder-tree">
      <div className="folder-tree-header">
        <h3>Library</h3>
      </div>
      <div className="folder-tree-content">
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
                onClick={() => onSelect(work.id)}
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