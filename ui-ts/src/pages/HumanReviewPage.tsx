import { useState } from 'react';
import type { FormEvent } from 'react';
import type { MetadataRecord } from '../lib/protocol';

interface Props {
  metadata: MetadataRecord | null;
  onSave: (patch: Record<string, unknown>) => Promise<void>;
}

function csv(values: string[] | undefined) {
  return (values ?? []).join(', ');
}

export function HumanReviewPage({ metadata, onSave }: Props) {
  const [summary, setSummary] = useState(() => metadata?.summary ?? '');
  const [keywords, setKeywords] = useState(() => csv(metadata?.tags?.keywords));
  const [persons, setPersons] = useState(() => csv(metadata?.tags?.entities?.persons));
  const [places, setPlaces] = useState(() => csv(metadata?.tags?.entities?.places));
  const [orgs, setOrgs] = useState(() => csv(metadata?.tags?.entities?.orgs));
  const [other, setOther] = useState(() => csv(metadata?.tags?.entities?.other));
  const [spatiotemporalRaw, setSpatiotemporalRaw] = useState(() => JSON.stringify(metadata?.spatiotemporal ?? [], null, 2));
  const [peopleRaw, setPeopleRaw] = useState(() => JSON.stringify(metadata?.people_annotations ?? [], null, 2));
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');

  function toArray(text: string): string[] {
    return text
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!metadata) return;
    if (!summary.trim()) {
      setStatus('Summary is required');
      return;
    }

    let spatiotemporal: unknown[];
    let peopleAnnotations: unknown[];
    try {
      spatiotemporal = JSON.parse(spatiotemporalRaw);
      peopleAnnotations = JSON.parse(peopleRaw);
      if (!Array.isArray(spatiotemporal) || !Array.isArray(peopleAnnotations)) {
        throw new Error('JSON fields must be arrays');
      }
    } catch (err) {
      setStatus(`Validation failed: ${(err as Error).message}`);
      return;
    }

    setSaving(true);
    setStatus('Saving...');
    try {
      await onSave({
        summary: summary.trim(),
        tags: {
          keywords: toArray(keywords),
          entities: {
            persons: toArray(persons),
            places: toArray(places),
            orgs: toArray(orgs),
            other: toArray(other),
          },
        },
        spatiotemporal,
        people_annotations: peopleAnnotations,
        notes: notes.trim(),
      });
      setStatus('Saved');
    } catch (err) {
      setStatus(`Failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="view active">
      <h2>Human Review Workbench</h2>
      {!metadata && <div className="panel">Select a metadata entry first.</div>}
      {metadata && (
        <>
          <form className="panel" onSubmit={submit}>
            <label>
              Summary
              <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={4} />
            </label>
            <label>
              Keywords (comma-separated)
              <input value={keywords} onChange={(e) => setKeywords(e.target.value)} />
            </label>
            <label>
              Persons (comma-separated)
              <input value={persons} onChange={(e) => setPersons(e.target.value)} />
            </label>
            <label>
              Places (comma-separated)
              <input value={places} onChange={(e) => setPlaces(e.target.value)} />
            </label>
            <label>
              Orgs (comma-separated)
              <input value={orgs} onChange={(e) => setOrgs(e.target.value)} />
            </label>
            <label>
              Other entities (comma-separated)
              <input value={other} onChange={(e) => setOther(e.target.value)} />
            </label>
            <label>
              Spatiotemporal JSON
              <textarea value={spatiotemporalRaw} onChange={(e) => setSpatiotemporalRaw(e.target.value)} rows={5} />
            </label>
            <label>
              People annotations JSON
              <textarea value={peopleRaw} onChange={(e) => setPeopleRaw(e.target.value)} rows={4} />
            </label>
            <label>
              Reviewer notes
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
            </label>
            <button type="submit" disabled={saving}>
              {saving ? 'Saving...' : 'Save Human Review'}
            </button>
          </form>
          <div className="panel">
            <h3>Save Result</h3>
            <pre>{status || 'No update submitted.'}</pre>
          </div>
        </>
      )}
    </section>
  );
}
