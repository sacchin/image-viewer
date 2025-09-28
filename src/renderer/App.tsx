import React, { useState, useEffect } from 'react';
import Layout from './components/Layout/Layout';
import StatusBar from './components/StatusBar/StatusBar';
import { SideMenu, PanelType } from './components/SideMenu';
import { DownloadPanel, ExplorePanel, LogPanel, SettingPanel } from './components/Panels';
import { useLibrary } from './hooks/useLibrary';
import { useMenu } from './hooks/useMenu';
import './styles/index.css';

function App() {
  const [activePanel, setActivePanel] = useState<PanelType>('explore');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedFolderPath, setSelectedFolderPath] = useState<string | null>(null);
  const { library, refreshLibrary } = useLibrary();

  // キーボードショートカットの処理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.altKey) {
        switch (e.key) {
          case '1':
            setActivePanel('download');
            break;
          case '2':
            setActivePanel('explore');
            break;
          case '3':
            setActivePanel('log');
            break;
          case '4':
            setActivePanel('setting');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useMenu({
    onNewDownload: () => {
      setActivePanel('download');
    },
    onOpenFolder: async () => {
      const folderPath = await window.electronAPI.selectDirectory();
      if (folderPath) {
        setSelectedFolderPath(folderPath);
        setActivePanel('explore');
      }
    },
    onViewChange: setViewMode,
    onRefresh: refreshLibrary
  });

  return (
    <Layout>
      <Layout.Main>
        <Layout.Sidebar>
          <SideMenu
            activeItem={activePanel}
            onItemClick={setActivePanel}
          />
        </Layout.Sidebar>

        <Layout.Content>
          <div style={{ display: activePanel === 'download' ? 'block' : 'none', height: '100%' }}>
            <DownloadPanel />
          </div>
          <div style={{ display: activePanel === 'explore' ? 'block' : 'none', height: '100%' }}>
            <ExplorePanel selectedFolderPath={selectedFolderPath} />
          </div>
          <div style={{ display: activePanel === 'log' ? 'block' : 'none', height: '100%' }}>
            <LogPanel />
          </div>
          <div style={{ display: activePanel === 'setting' ? 'block' : 'none', height: '100%' }}>
            <SettingPanel />
          </div>
        </Layout.Content>
      </Layout.Main>

      <Layout.Footer>
        <StatusBar
          selectedWork={activePanel === 'explore' ? 'Current Folder' : null}
          currentPanel={activePanel.charAt(0).toUpperCase() + activePanel.slice(1)}
        />
      </Layout.Footer>
    </Layout>
  );
}

export default App;