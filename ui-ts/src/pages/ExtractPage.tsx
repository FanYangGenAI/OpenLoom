import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ApiClient } from '../lib/api';

interface Props {
  api: ApiClient;
  extractPath: string;
  setExtractPath: (value: string) => void;
  openloomDir: string;
  setOpenloomDir: (value: string) => void;
  progressText: string;
  onBrowse: () => void;
  onExtractDone: () => Promise<void>;
  setToast: (message: string, type: 'info' | 'success' | 'error') => void;
}

export function ExtractPage({
  api,
  extractPath,
  setExtractPath,
  openloomDir,
  setOpenloomDir,
  progressText,
  onBrowse,
  onExtractDone,
  setToast,
}: Props) {
  const [force, setForce] = useState(false);
  const [skipFaces, setSkipFaces] = useState(true);
  const [ocrProvider, setOcrProvider] = useState<'online' | 'local'>('online');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      await api.extractStart({
        path: extractPath,
        force,
        skipFaces,
        ocrProvider,
        openloomDir,
      });
      await onExtractDone();
      setToast('Extract finished', 'success');
    } catch (err) {
      setToast(`Extract failed: ${(err as Error).message}`, 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="view active">
      <h2>Extract Console</h2>
      <form className="panel" onSubmit={submit}>
        <label>
          Target File or Directory
          <div className="row">
            <input value={extractPath} onChange={(e) => setExtractPath(e.target.value)} />
            <button type="button" onClick={onBrowse}>
              Browse...
            </button>
          </div>
        </label>
        <div className="row">
          <label>
            <input type="checkbox" checked={force} onChange={(e) => setForce(e.target.checked)} />
            Force re-extract
          </label>
          <label>
            <input type="checkbox" checked={skipFaces} onChange={(e) => setSkipFaces(e.target.checked)} />
            Skip face detection
          </label>
        </div>
        <div className="row">
          <label>
            OCR Provider
            <select value={ocrProvider} onChange={(e) => setOcrProvider(e.target.value as 'online' | 'local')}>
              <option value="online">online</option>
              <option value="local">local</option>
            </select>
          </label>
          <label>
            OpenLoom Directory
            <input value={openloomDir} onChange={(e) => setOpenloomDir(e.target.value)} />
          </label>
        </div>
        <button type="submit" disabled={loading}>
          {loading ? 'Extracting...' : 'Start Extract'}
        </button>
      </form>
      <div className="panel">
        <h3>Progress</h3>
        <pre>{progressText || 'No extraction running.'}</pre>
      </div>
    </section>
  );
}
