import React from 'react';
import './StatusBar.css';

interface StatusBarProps {
  selectedWork: string | null;
}

const StatusBar: React.FC<StatusBarProps> = ({ selectedWork }) => {
  return (
    <div className="status-bar">
      <span className="status-bar-item">
        {selectedWork ? `Selected: ${selectedWork}` : 'No work selected'}
      </span>
      <span className="status-bar-item status-bar-right">
        Ready
      </span>
    </div>
  );
};

export default StatusBar;