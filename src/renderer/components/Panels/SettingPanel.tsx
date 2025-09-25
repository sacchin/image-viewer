import React, { useState, useEffect } from 'react';
import './SettingPanel.css';

interface Settings {
  defaultDownloadPath: string;
}

export const SettingPanel: React.FC = () => {
  const [settings, setSettings] = useState<Settings>({
    defaultDownloadPath: 'C:\\Users\\Downloads'
  });
  const [isSaving, setIsSaving] = useState(false);

  // Load settings on component mount
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const loadedSettings = await window.electronAPI.getSettings();
        if (loadedSettings) {
          setSettings(loadedSettings);
        }
      } catch (error) {
        console.error('Failed to load settings:', error);
      }
    };
    loadSettings();
  }, []);

  const handleSettingChange = <K extends keyof Settings>(
    key: K,
    value: Settings[K]
  ) => {
    setSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await window.electronAPI.saveSettings(settings);
      console.log('Settings saved successfully');
    } catch (error) {
      console.error('Failed to save settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetSettings = async () => {
    try {
      const defaultSettings = await window.electronAPI.resetSettings();
      setSettings(defaultSettings);
      console.log('Settings reset to defaults');
    } catch (error) {
      console.error('Failed to reset settings:', error);
    }
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
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
};