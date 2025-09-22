import { useState, useEffect } from 'react';

export function useLibrary() {
  const [library, setLibrary] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const refreshLibrary = async () => {
    setLoading(true);
    try {
      const data = await window.electronAPI.readLibrary();
      setLibrary(data);
    } catch (error) {
      console.error('Failed to load library:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshLibrary();
  }, []);

  return { library, loading, refreshLibrary };
}