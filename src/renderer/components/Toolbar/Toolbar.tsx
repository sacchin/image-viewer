import React from 'react';
import './Toolbar.css';

const Toolbar: React.FC = () => {
  return (
    <div className="toolbar" data-testid="toolbar">
      <button className="toolbar-button" data-testid="folder-open-btn" title="Import Folder">
        📁 Import
      </button>
      <button className="toolbar-button" title="New Download">
        ⬇️ Download
      </button>
      <div className="toolbar-separator"></div>
      <button className="toolbar-button" data-testid="view-mode-btn" title="View Mode">
        👁️ View
      </button>
      <button className="toolbar-button" data-testid="sort-btn" title="Sort">
        ↕️ Sort
      </button>
      <button className="toolbar-button" data-testid="filter-btn" title="Filter">
        🎯 Filter
      </button>
      <input type="text" className="toolbar-search" data-testid="search-input" placeholder="Search..." />
      <button className="toolbar-button" title="Refresh">
        🔄 Refresh
      </button>
    </div>
  );
};

export default Toolbar;