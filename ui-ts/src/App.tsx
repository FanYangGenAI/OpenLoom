import { useEffect, useMemo, useState } from 'react';
import './styles/app.css';
import { Toast } from './components/Toast';
import { FolderPickerModal } from './components/FolderPickerModal';
import { ExtractPage } from './pages/ExtractPage';
import { MetadataListPage } from './pages/MetadataListPage';
import { MetadataDetailPage } from './pages/MetadataDetailPage';
import { HumanReviewPage } from './pages/HumanReviewPage';
import { useAppStore, type ViewName } from './store/useAppStore';
import type { MetadataListItem } from './lib/protocol';

function App() {
  const store = useAppStore();
  const [pickerOpen, setPickerOpen] = useState(false);
  const tabs: Array<{ id: ViewName; label: string }> = useMemo(
    () => [
      { id: 'extract', label: 'Extract' },
      { id: 'list', label: 'Metadata List' },
      { id: 'detail', label: 'Metadata Detail' },
      { id: 'review', label: 'Human Review' },
    ],
    [],
  );

  async function loadMetadataList() {
    const result = await store.api.metadataList({
      fileType: store.listType || undefined,
      keyword: store.keyword || undefined,
      page: 1,
      pageSize: 100,
      openloomDir: store.openloomDir,
    });
    store.setItems(result.items);
  }

  async function openMetadata(item: MetadataListItem) {
    const result = await store.api.metadataGet(item.hash, item.file_type, store.openloomDir);
    store.setSelectedMetadata(result.metadata);
    store.setSelectedVersion(result.metadata_version);
    store.setCurrentView('detail');
  }

  async function saveHumanReview(patch: Record<string, unknown>) {
    if (!store.selectedMetadata || store.selectedVersion === null) return;
    const result = await store.api.metadataUpdate({
      hash: store.selectedMetadata.hash,
      fileType: store.selectedMetadata.file_type,
      expectedVersion: store.selectedVersion,
      patch,
      openloomDir: store.openloomDir,
    });
    store.setSelectedMetadata(result.metadata);
    store.setSelectedVersion(result.metadata_version);
    await loadMetadataList();
    store.setToast('Saved human review', 'success');
  }

  useEffect(() => {
    store.api.connect();
    void loadMetadataList().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const progressText = store.extractProgress
    ? [
        `status: ${store.extractProgress.status}`,
        `completed: ${store.extractProgress.completed}/${store.extractProgress.total}`,
        `text_done: ${store.extractProgress.textDone}`,
        `image_done: ${store.extractProgress.imageDone}`,
        `file: ${store.extractProgress.file}`,
      ].join('\n')
    : 'No extraction running.';

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <h1>OpenLoom</h1>
          <span className="subtitle">React + TypeScript MVP</span>
        </div>
        <div className="connection">
          <span className={`indicator ${store.connected ? 'connected' : ''}`}></span>
          <span>{store.connected ? 'Connected' : 'Disconnected'}</span>
        </div>
      </header>

      <nav className="tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`tab ${store.currentView === tab.id ? 'active' : ''}`}
            onClick={() => store.setCurrentView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <main className="content">
        {store.currentView === 'extract' && (
          <ExtractPage
            api={store.api}
            extractPath={store.extractPath}
            setExtractPath={store.setExtractPath}
            openloomDir={store.openloomDir}
            setOpenloomDir={store.setOpenloomDir}
            progressText={progressText}
            onBrowse={() => setPickerOpen(true)}
            onExtractDone={loadMetadataList}
            setToast={store.setToast}
          />
        )}
        {store.currentView === 'list' && (
          <MetadataListPage
            items={store.items}
            fileType={store.listType}
            keyword={store.keyword}
            setFileType={store.setListType}
            setKeyword={store.setKeyword}
            onSearch={loadMetadataList}
            onOpenItem={(item) => void openMetadata(item)}
          />
        )}
        {store.currentView === 'detail' && (
          <MetadataDetailPage metadata={store.selectedMetadata} onOpenReview={() => store.setCurrentView('review')} />
        )}
        {store.currentView === 'review' && (
          <HumanReviewPage
            key={`${store.selectedMetadata?.hash ?? 'none'}-${store.selectedVersion ?? 0}`}
            metadata={store.selectedMetadata}
            onSave={saveHumanReview}
          />
        )}
      </main>

      <FolderPickerModal
        open={pickerOpen}
        api={store.api}
        initialPath={store.extractPath}
        onCancel={() => setPickerOpen(false)}
        onSelect={(path) => {
          store.setExtractPath(path);
          setPickerOpen(false);
        }}
      />
      <Toast message={store.toast.message} type={store.toast.type} />
    </div>
  );
}

export default App;
