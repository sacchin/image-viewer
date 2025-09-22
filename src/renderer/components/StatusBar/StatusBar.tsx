import React from 'react';
import './StatusBar.css';

interface StatusBarProps {
  selectedWork: string | null;
}

const StatusBar: React.FC<StatusBarProps> = ({ selectedWork }) => {
  return (
    <div className="status-bar" data-testid="status-bar">
      <span className="status-bar-item" data-testid="item-count">
        0 items
      </span>
      <span className="status-bar-item" data-testid="selected-count">
        0 selected
      </span>
      <span className="status-bar-item status-bar-right" data-testid="zoom-level">
        100%
      </span>
    </div>
  );
};

export default StatusBar;