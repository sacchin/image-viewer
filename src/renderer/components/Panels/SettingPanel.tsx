import React, { useState } from 'react';
import './SettingPanel.css';

interface Settings {
  theme: 'light' | 'dark' | 'auto';
  defaultDownloadPath: string;
  imageQuality: 'low' | 'medium' | 'high';
  autoLoadImages: boolean;
  showThumbnails: boolean;
  thumbnailSize: number;
  rememberWindowSize: boolean;
}

export const SettingPanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    theme: 'auto',
    defaultDownloadPath: 'C:\\Users\\Downloads',
    imageQuality: 'high',
    autoLoadImages: true,
    showThumbnails: true,
    thumbnailSize: 150,
    rememberWindowSize: true
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
      theme: 'auto',
      defaultDownloadPath: 'C:\\Users\\Downloads',
      imageQuality: 'high',
      autoLoadImages: true,
      showThumbnails: true,
      thumbnailSize: 150,
      rememberWindowSize: true
    });
  };

  return (
    <div className="setting-panel" data-panel="setting">
      <div className="setting-panel-header">
        <h2>Settings</h2>
      </div>

      <div className="setting-panel-content">
        <div className="setting-section">
          <h3 className="setting-section-title">Appearance</h3>
          <div className="setting-item">
            <label className="setting-label">Theme</label>
            <select
              className="setting-select"
              value={settings.theme}
              onChange={(e) => handleSettingChange('theme', e.target.value as Settings['theme'])}
            >
              <option value="light">Light</option>
              <option value="dark">Dark</option>
              <option value="auto">Auto (System)</option>
            </select>
          </div>
        </div>

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

        <div className="setting-section">
          <h3 className="setting-section-title">Image Display</h3>
          <div className="setting-item">
            <label className="setting-label">Image Quality</label>
            <select
              className="setting-select"
              value={settings.imageQuality}
              onChange={(e) => handleSettingChange('imageQuality', e.target.value as Settings['imageQuality'])}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>

          <div className="setting-item">
            <label className="setting-checkbox-label">
              <input
                type="checkbox"
                className="setting-checkbox"
                checked={settings.autoLoadImages}
                onChange={(e) => handleSettingChange('autoLoadImages', e.target.checked)}
              />
              Auto-load images when folder is selected
            </label>
          </div>

          <div className="setting-item">
            <label className="setting-checkbox-label">
              <input
                type="checkbox"
                className="setting-checkbox"
                checked={settings.showThumbnails}
                onChange={(e) => handleSettingChange('showThumbnails', e.target.checked)}
              />
              Show thumbnails in grid view
            </label>
          </div>

          <div className="setting-item">
            <label className="setting-label">Thumbnail Size</label>
            <div className="setting-slider-container">
              <input
                type="range"
                className="setting-slider"
                min="50"
                max="300"
                value={settings.thumbnailSize}
                onChange={(e) => handleSettingChange('thumbnailSize', Number(e.target.value))}
              />
              <span className="setting-slider-value">{settings.thumbnailSize}px</span>
            </div>
          </div>
        </div>

        <div className="setting-section">
          <h3 className="setting-section-title">Application</h3>
          <div className="setting-item">
            <label className="setting-checkbox-label">
              <input
                type="checkbox"
                className="setting-checkbox"
                checked={settings.rememberWindowSize}
                onChange={(e) => handleSettingChange('rememberWindowSize', e.target.checked)}
              />
              Remember window size and position
            </label>
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