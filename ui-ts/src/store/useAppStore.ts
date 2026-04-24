import { useMemo, useState } from 'react';
import { createApiClient } from '../lib/api';
import type { ExtractProgress, MetadataListItem, MetadataRecord } from '../lib/protocol';

export type ViewName = 'extract' | 'list' | 'detail' | 'review';

export function useAppStore() {
  const [connected, setConnected] = useState(false);
  const [currentView, setCurrentView] = useState<ViewName>('extract');
  const [extractPath, setExtractPath] = useState('./data/fanyang');
  const [openloomDir, setOpenloomDir] = useState('./.openloom');
  const [extractProgress, setExtractProgress] = useState<ExtractProgress | null>(null);
  const [listType, setListType] = useState('');
  const [keyword, setKeyword] = useState('');
  const [items, setItems] = useState<MetadataListItem[]>([]);
  const [selectedMetadata, setSelectedMetadata] = useState<MetadataRecord | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [toast, setToastState] = useState<{ message: string; type: 'info' | 'success' | 'error' }>({
    message: '',
    type: 'info',
  });

  const api = useMemo(
    () =>
      createApiClient(
        (event) => setExtractProgress(event.data),
        (isConnected) => setConnected(isConnected),
      ),
    [],
  );

  function setToast(message: string, type: 'info' | 'success' | 'error') {
    setToastState({ message, type });
    window.setTimeout(() => setToastState({ message: '', type: 'info' }), 2500);
  }

  return {
    connected,
    currentView,
    setCurrentView,
    extractPath,
    setExtractPath,
    openloomDir,
    setOpenloomDir,
    extractProgress,
    listType,
    setListType,
    keyword,
    setKeyword,
    items,
    setItems,
    selectedMetadata,
    setSelectedMetadata,
    selectedVersion,
    setSelectedVersion,
    toast,
    setToast,
    api,
  };
}
