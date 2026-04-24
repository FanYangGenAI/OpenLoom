import type { MetadataRecord } from '../lib/protocol';

interface Props {
  metadata: MetadataRecord | null;
  onOpenReview: () => void;
}

export function MetadataDetailPage({ metadata, onOpenReview }: Props) {
  return (
    <section className="view active">
      <h2>Metadata Detail</h2>
      <div className="panel">
        {!metadata && <p>Select an item from Metadata List first.</p>}
        {metadata && (
          <>
            <p>
              {metadata.file_name} ({metadata.file_type})
            </p>
            <pre>{JSON.stringify(metadata, null, 2)}</pre>
            <button type="button" onClick={onOpenReview}>
              Open in Human Review
            </button>
          </>
        )}
      </div>
    </section>
  );
}
