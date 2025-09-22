import React from 'react';
import './StatusBar.css';

interface StatusBarProps {
  selectedWork: string | null;
  currentPanel?: string;
}

const StatusBar: React.FC<StatusBarProps> = ({ selectedWork, currentPanel }) => {
  return (
    <div className="status-bar" data-testid="status-bar">
      <span className="status-bar-item" data-testid="item-count">
        0 items
      </span>
      <span className="status-bar-item" data-testid="selected-count">
        0 selected
      </span>
      {currentPanel && (
        <span className="status-bar-item current-panel">
          Panel: {currentPanel}
        </span>
      )}
      <span className="status-bar-item status-bar-right" data-testid="zoom-level">
        100%
      </span>
    </div>
  );
};

export default StatusBar;