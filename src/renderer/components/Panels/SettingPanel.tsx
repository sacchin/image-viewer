import React, { useState } from 'react';
import './SettingPanel.css';

interface Settings {
  defaultDownloadPath: string;
}

export const SettingPanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    defaultDownloadPath: 'C:\\Users\\Downloads'
  });

  const handleSettingChange = <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSettings = () => {
    console.log('Saving settings:', settings);
  };

  const handleResetSettings = () => {
    setSettings({
      defaultDownloadPath: 'C:\\Users\\Downloads'
    });
  };

  return (
    <div className="setting-panel" data-panel="setting">
      <div className="setting-panel-header">
        <h2>Settings</h2>
      </div>

      <div className="setting-panel-content">
        <div className="setting-section">
          <h3 className="setting-section-title">File Management</h3>
          <div className="setting-item">
            <label className="setting-label">Default Download Path</label>
            <div className="setting-path-input">
              <input
                type="text"
                className="setting-input"
                value={settings.defaultDownloadPath}
                onChange={(e) => handleSettingChange('defaultDownloadPath', e.target.value)}
              />
              <button className="setting-browse-btn">Browse...</button>
            </div>
          </div>
        </div>
      </div>

      <div className="setting-panel-footer">
        <button
          className="setting-btn setting-btn-secondary"
          onClick={handleResetSettings}
        >
          Reset to Defaults
        </button>
        <button
          className="setting-btn setting-btn-primary"
          onClick={handleSaveSettings}
        >
          Save Settings
        </button>
      </div>
    </div>
  );
};