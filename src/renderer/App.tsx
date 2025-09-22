import React, { useState, useEffect } from 'react';
import Layout from './components/Layout/Layout';
import FolderTree from './components/FolderTree/FolderTree';
import ImageGrid from './components/ImageGrid/ImageGrid';
import Toolbar from './components/Toolbar/Toolbar';
import StatusBar from './components/StatusBar/StatusBar';
import { useLibrary } from './hooks/useLibrary';
import { useMenu } from './hooks/useMenu';
import './styles/index.css';

function App() {
  const [selectedWork, setSelectedWork] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const { library, refreshLibrary } = useLibrary();

  useMenu({
    onNewDownload: () => console.log('New download'),
    onViewChange: setViewMode,
    onRefresh: refreshLibrary
  });

  return (
    <Layout>
      <Layout.Header>
        <Toolbar />
      </Layout.Header>

      <Layout.Main>
        <Layout.Sidebar>
          <FolderTree
            works={library}
            selectedWork={selectedWork}
            onSelect={setSelectedWork}
          />
        </Layout.Sidebar>

        <Layout.Content>
          <ImageGrid
            workId={selectedWork}
            viewMode={viewMode}
          />
        </Layout.Content>
      </Layout.Main>

      <Layout.Footer>
        <StatusBar selectedWork={selectedWork} />
      </Layout.Footer>
    </Layout>
  );
}

export default App;