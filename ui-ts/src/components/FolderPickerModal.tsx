import { useEffect, useState } from 'react';
import type { ApiClient } from '../lib/api';

interface Props {
  open: boolean;
  api: ApiClient;
  initialPath: string;
  onCancel: () => void;
  onSelect: (path: string) => void;
}

export function FolderPickerModal({ open, api, initialPath, onCancel, onSelect }: Props) {
  const [currentPath, setCurrentPath] = useState('');
  const [dirs, setDirs] = useState<Array<{ name: string; fullPath: string }>>([]);
  const [error, setError] = useState('');

  async function load(path?: string) {
    try {
      setError('');
      const result = await api.listDirectories(path);
      setCurrentPath(result.currentPath);
      setDirs(result.directories);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void load(initialPath);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div className="modal">
      <div className="modal-card">
        <h3>Select Directory</h3>
        <div className="row">
          <input type="text" readOnly value={currentPath} />
          <button type="button" onClick={() => load(`${currentPath}/..`)}>
            Up
          </button>
        </div>
        <div className="folder-list">
          {error && <div className="folder-item">Failed: {error}</div>}
          {!error && dirs.length === 0 && <div className="folder-item">No subdirectories</div>}
          {!error &&
            dirs.map((dir) => (
              <div key={dir.fullPath} className="folder-item" onClick={() => load(dir.fullPath)}>
                {dir.name}
              </div>
            ))}
        </div>
        <div className="row">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" onClick={() => onSelect(currentPath)}>
            Use This Folder
          </button>
        </div>
      </div>
    </div>
  );
}
