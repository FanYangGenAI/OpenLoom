import type { FormEvent } from 'react';
import type { MetadataListItem } from '../lib/protocol';

interface Props {
  items: MetadataListItem[];
  fileType: string;
  keyword: string;
  setFileType: (value: string) => void;
  setKeyword: (value: string) => void;
  onSearch: () => Promise<void>;
  onOpenItem: (item: MetadataListItem) => void;
}

export function MetadataListPage({
  items,
  fileType,
  keyword,
  setFileType,
  setKeyword,
  onSearch,
  onOpenItem,
}: Props) {
  async function submit(event: FormEvent) {
    event.preventDefault();
    await onSearch();
  }

  return (
    <section className="view active">
      <h2>Metadata List</h2>
      <form className="panel" onSubmit={submit}>
        <div className="row">
          <label>
            Type
            <select value={fileType} onChange={(e) => setFileType(e.target.value)}>
              <option value="">all</option>
              <option value="text_doc">text_doc</option>
              <option value="image">image</option>
            </select>
          </label>
          <label>
            Keyword
            <input value={keyword} onChange={(e) => setKeyword(e.target.value)} />
          </label>
          <button type="submit">Search</button>
        </div>
      </form>
      <div className="panel">
        <table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Type</th>
              <th>Modified</th>
              <th>Tags</th>
              <th>Errors</th>
              <th>Reviewed</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 && (
              <tr>
                <td colSpan={6}>No metadata found.</td>
              </tr>
            )}
            {items.map((item) => (
              <tr key={`${item.file_type}-${item.hash}`} data-clickable="true" onClick={() => onOpenItem(item)}>
                <td>{item.file_name}</td>
                <td>{item.file_type}</td>
                <td>{item.modified_at}</td>
                <td>{item.tags_count}</td>
                <td>{item.extraction_errors_count}</td>
                <td>{item.reviewed ? 'yes' : 'no'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
