import React, { useState, useEffect } from 'react';
import './LogPanel.css';

type LogLevel = 'info' | 'warning' | 'error';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  message: string;
  source?: string;
}

export const LogPanel: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: '1',
      timestamp: new Date(),
      level: 'info',
      message: 'Application started successfully',
      source: 'App'
    },
    {
      id: '2',
      timestamp: new Date(),
      level: 'info',
      message: 'Image viewer initialized',
      source: 'ImageGrid'
    }
  ]);
  const [filter, setFilter] = useState<LogLevel | 'all'>('all');

  const getLevelIcon = (level: LogLevel) => {
    switch (level) {
      case 'info':
        return 'ℹ️';
      case 'warning':
        return '⚠️';
      case 'error':
        return '❌';
    }
  };

  const getLevelClass = (level: LogLevel) => {
    return `log-level-${level}`;
  };

  const clearLogs = () => {
    setLogs([]);
  };

  const filteredLogs = filter === 'all'
    ? logs
    : logs.filter(log => log.level === filter);

  const formatTimestamp = (date: Date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };

  return (
    <div className="log-panel" data-panel="log">
      <div className="log-panel-header">
        <h2>Application Logs</h2>
        <div className="log-panel-controls">
          <select
            className="log-filter-select"
            value={filter}
            onChange={(e) => setFilter(e.target.value as LogLevel | 'all')}
          >
            <option value="all">All Levels</option>
            <option value="info">Info</option>
            <option value="warning">Warning</option>
            <option value="error">Error</option>
          </select>
          <button
            className="log-clear-btn"
            onClick={clearLogs}
          >
            Clear Logs
          </button>
        </div>
      </div>

      <div className="log-panel-content">
        {filteredLogs.length === 0 ? (
          <div className="log-panel-empty">
            <p>No logs to display</p>
          </div>
        ) : (
          <div className="log-list">
            {filteredLogs.map(log => (
              <div key={log.id} className={`log-entry ${getLevelClass(log.level)}`}>
                <span className="log-timestamp">
                  {formatTimestamp(log.timestamp)}
                </span>
                <span className="log-level-icon">
                  {getLevelIcon(log.level)}
                </span>
                {log.source && (
                  <span className="log-source">[{log.source}]</span>
                )}
                <span className="log-message">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};