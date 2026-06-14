import { useState } from 'react';
import { buildPath } from './jsonTree';

function ChevronIcon({ open }) {
  return (
    <svg
      className={`json-tree-chevron ${open ? 'json-tree-chevron-open' : ''}`}
      width="10"
      height="10"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function JsonNode({ data, segments, selectedPath, onPick, depth }) {
  const path = buildPath(segments);
  const isSelected = selectedPath === path;
  const [open, setOpen] = useState(depth < 2);
  const pad = { paddingLeft: `${depth * 14 + 12}px` };

  if (data === null || data === undefined) {
    return (
      <button
        type="button"
        className={`json-row ${isSelected ? 'json-row-selected' : ''}`}
        onClick={() => onPick(path)}
        style={pad}
      >
        <span className="json-key">{segments[segments.length - 1] ?? '$'}</span>
        <span className="json-colon">:</span>
        <span className="json-value json-value-null">null</span>
        <span className="json-path-tag">{path}</span>
      </button>
    );
  }

  if (Array.isArray(data)) {
    return (
      <div className="json-block">
        <button
          type="button"
          className={`json-row json-row-collection ${isSelected ? 'json-row-selected' : ''}`}
          onClick={() => onPick(path)}
          style={pad}
        >
          <span
            className="json-toggle"
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
            role="button"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            <ChevronIcon open={open} />
          </span>
          <span className="json-key">{segments.length === 0 ? '$' : segments[segments.length - 1]}</span>
          <span className="json-colon">:</span>
          <span className="json-value json-value-meta">Array({data.length})</span>
          <span className="json-path-tag">{path}</span>
        </button>
        {open && data.map((item, i) => (
          <JsonNode
            key={i}
            data={item}
            segments={[...segments, i]}
            selectedPath={selectedPath}
            onPick={onPick}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  if (typeof data === 'object') {
    const entries = Object.entries(data);
    return (
      <div className="json-block">
        <button
          type="button"
          className={`json-row json-row-collection ${isSelected ? 'json-row-selected' : ''}`}
          onClick={() => onPick(path)}
          style={pad}
        >
          <span
            className="json-toggle"
            onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
            role="button"
            aria-label={open ? 'Collapse' : 'Expand'}
          >
            <ChevronIcon open={open} />
          </span>
          <span className="json-key">{segments.length === 0 ? '$' : segments[segments.length - 1]}</span>
          <span className="json-colon">:</span>
          <span className="json-value json-value-meta">
            {`{ ${entries.length} ${entries.length === 1 ? 'key' : 'keys'} }`}
          </span>
          <span className="json-path-tag">{path}</span>
        </button>
        {open && entries.map(([k, v]) => (
          <JsonNode
            key={k}
            data={v}
            segments={[...segments, k]}
            selectedPath={selectedPath}
            onPick={onPick}
            depth={depth + 1}
          />
        ))}
      </div>
    );
  }

  const typeClass =
    typeof data === 'string' ? 'json-value-string' :
    typeof data === 'number' ? 'json-value-number' :
    typeof data === 'boolean' ? 'json-value-boolean' : '';

  return (
    <button
      type="button"
      className={`json-row ${isSelected ? 'json-row-selected' : ''}`}
      onClick={() => onPick(path)}
      style={pad}
    >
      <span className="json-key">{segments[segments.length - 1] ?? '$'}</span>
      <span className="json-colon">:</span>
      <span className={`json-value ${typeClass}`}>
        {typeof data === 'string' ? `"${data}"` : String(data)}
      </span>
      <span className="json-path-tag">{path}</span>
    </button>
  );
}

export function JsonTreeView({ data, selectedPath, onPick }) {
  return <JsonNode data={data} segments={[]} selectedPath={selectedPath} onPick={onPick} depth={0} />;
}
