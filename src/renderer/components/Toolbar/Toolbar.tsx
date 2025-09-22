import React from 'react';
import './Toolbar.css';

const Toolbar: React.FC = () => {
  return (
    <div className="toolbar">
      <button className="toolbar-button" title="Import Folder">
        📁 Import
      </button>
      <button className="toolbar-button" title="New Download">
        ⬇️ Download
      </button>
      <div className="toolbar-separator"></div>
      <button className="toolbar-button" title="Search">
        🔍 Search
      </button>
      <button className="toolbar-button" title="Refresh">
        🔄 Refresh
      </button>
    </div>
  );
};

export default Toolbar;