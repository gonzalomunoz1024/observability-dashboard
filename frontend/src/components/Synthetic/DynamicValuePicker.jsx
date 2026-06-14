import { useEffect, useMemo, useState } from 'react';
import './DynamicValuePicker.css';

const GENERATORS = [
  { value: 'uuid',         label: 'UUID',           hint: 'random v4' },
  { value: 'randomInt',    label: 'Random int',     args: ['min', 'max'], defaults: ['1', '100'] },
  { value: 'randomString', label: 'Random string',  args: ['length'], defaults: ['8'] },
  { value: 'timestampIso', label: 'Timestamp (ISO)' },
  { value: 'timestampMs',  label: 'Timestamp (ms)' },
  { value: 'email',        label: 'Email' },
];

const SAFE_KEY = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function buildPath(segments) {
  let out = '$';
  for (const seg of segments) {
    if (typeof seg === 'number') out += `[${seg}]`;
    else if (SAFE_KEY.test(seg)) out += `.${seg}`;
    else out += `['${seg.replace(/'/g, "\\'")}']`;
  }
  return out;
}

function valuePreview(v) {
  if (v === null) return 'null';
  if (typeof v === 'string') return `"${v.length > 24 ? v.slice(0, 24) + '…' : v}"`;
  if (Array.isArray(v)) return `[ ${v.length} ]`;
  if (typeof v === 'object') return `{ ${Object.keys(v).length} }`;
  return String(v);
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`dv-chev ${open ? 'dv-chev-open' : ''}`}
      width="10" height="10" viewBox="0 0 16 16" fill="none" aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function suggestGenerator(value) {
  if (typeof value === 'number' && Number.isInteger(value)) return 'randomInt';
  if (typeof value === 'string') {
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)) return 'uuid';
    if (/^\d{4}-\d{2}-\d{2}T/.test(value)) return 'timestampIso';
    if (/^\d{10,}$/.test(value)) return 'timestampMs';
    if (/@/.test(value)) return 'email';
    return 'randomString';
  }
  return 'uuid';
}

function TreeNode({ data, segments, selectedPath, onSelect, depth }) {
  const path = buildPath(segments);
  const isSelected = selectedPath === path;
  const [open, setOpen] = useState(depth < 1);

  const pad = { paddingLeft: `${depth * 14 + 10}px` };

  if (data === null || data === undefined) {
    return (
      <button type="button" className={`dv-row ${isSelected ? 'dv-row-sel' : ''}`} style={pad} onClick={() => onSelect(path, data)}>
        <span className="dv-key">{segments[segments.length - 1] ?? '$'}</span>
        <span className="dv-colon">:</span>
        <span className="dv-val dv-val-null">null</span>
      </button>
    );
  }
  if (Array.isArray(data)) {
    return (
      <div>
        <button type="button" className={`dv-row dv-row-coll ${isSelected ? 'dv-row-sel' : ''}`} style={pad} onClick={() => onSelect(path, data)}>
          <span className="dv-toggle" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
            <ChevronIcon open={open} />
          </span>
          <span className="dv-key">{segments.length === 0 ? '$' : segments[segments.length - 1]}</span>
          <span className="dv-colon">:</span>
          <span className="dv-val dv-val-meta">[ {data.length} ]</span>
        </button>
        {open && data.map((item, i) => (
          <TreeNode key={i} data={item} segments={[...segments, i]} selectedPath={selectedPath} onSelect={onSelect} depth={depth + 1} />
        ))}
      </div>
    );
  }
  if (typeof data === 'object') {
    const entries = Object.entries(data);
    return (
      <div>
        <button type="button" className={`dv-row dv-row-coll ${isSelected ? 'dv-row-sel' : ''}`} style={pad} onClick={() => onSelect(path, data)}>
          <span className="dv-toggle" onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}>
            <ChevronIcon open={open} />
          </span>
          <span className="dv-key">{segments.length === 0 ? '$' : segments[segments.length - 1]}</span>
          <span className="dv-colon">:</span>
          <span className="dv-val dv-val-meta">{`{ ${entries.length} }`}</span>
        </button>
        {open && entries.map(([k, v]) => (
          <TreeNode key={k} data={v} segments={[...segments, k]} selectedPath={selectedPath} onSelect={onSelect} depth={depth + 1} />
        ))}
      </div>
    );
  }
  const typeClass =
    typeof data === 'string' ? 'dv-val-string' :
    typeof data === 'number' ? 'dv-val-number' :
    typeof data === 'boolean' ? 'dv-val-bool' : '';

  return (
    <button type="button" className={`dv-row ${isSelected ? 'dv-row-sel' : ''}`} style={pad} onClick={() => onSelect(path, data)}>
      <span className="dv-key">{segments[segments.length - 1] ?? '$'}</span>
      <span className="dv-colon">:</span>
      <span className={`dv-val ${typeClass}`}>{typeof data === 'string' ? `"${data}"` : String(data)}</span>
    </button>
  );
}

export function DynamicValuePicker({ open, body, onAdd, onClose, existingPaths }) {
  const [selected, setSelected] = useState(null);
  const [generator, setGenerator] = useState('uuid');
  const [args, setArgs] = useState(['1', '100']);
  const [parseError, setParseError] = useState(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (open) {
      setSelected(null);
      setGenerator('uuid');
      setArgs(['1', '100']);
      setParseError(null);
    }
  }, [open]);

  const parsed = useMemo(() => {
    if (!body) return null;
    try { return JSON.parse(body); } catch (e) { setParseError(e.message); return null; }
  }, [body]);

  const handleSelect = (path, value) => {
    setSelected({ path, value });
    const suggested = suggestGenerator(value);
    setGenerator(suggested);
    const spec = GENERATORS.find((g) => g.value === suggested);
    setArgs(spec?.defaults ? [...spec.defaults] : []);
  };

  const handleAdd = () => {
    if (!selected) return;
    const path = selected.path.startsWith('$.') ? selected.path.slice(2) : selected.path.replace(/^\$/, '');
    if (!path) return;
    onAdd({ path, generator, args });
    onClose();
  };

  if (!open) return null;

  const spec = GENERATORS.find((g) => g.value === generator);
  const isExisting = selected && existingPaths?.includes(
    selected.path.startsWith('$.') ? selected.path.slice(2) : selected.path.replace(/^\$/, '')
  );

  return (
    <div className="dv-overlay" onClick={onClose}>
      <div className="dv-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="dv-header">
          <div className="dv-title-group">
            <span className="dv-eyebrow">Dynamic value</span>
            <h3 className="dv-title">Pick a key in the body</h3>
          </div>
          <button type="button" className="dv-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="dv-body">
          <div className="dv-tree">
            {parsed == null ? (
              <p className="dv-empty">
                {parseError ? `Body isn't valid JSON: ${parseError}` : 'Body is empty.'}
              </p>
            ) : (
              <TreeNode
                data={parsed}
                segments={[]}
                selectedPath={selected?.path}
                onSelect={handleSelect}
                depth={0}
              />
            )}
          </div>

          <div className="dv-side">
            <div className="dv-side-block">
              <span className="dv-side-label">Selected path</span>
              <code className="dv-side-path">{selected?.path || '—'}</code>
              {selected?.value !== undefined && (
                <span className="dv-side-preview">current value: {valuePreview(selected.value)}</span>
              )}
              {isExisting && (
                <span className="dv-side-warn">Already marked dynamic — adding will replace it.</span>
              )}
            </div>

            <div className="dv-side-block">
              <label className="dv-side-label" htmlFor="dv-gen">Generator</label>
              <select
                id="dv-gen"
                value={generator}
                onChange={(e) => {
                  const v = e.target.value;
                  setGenerator(v);
                  const next = GENERATORS.find((g) => g.value === v);
                  setArgs(next?.defaults ? [...next.defaults] : []);
                }}
              >
                {GENERATORS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
              {spec?.hint && <span className="dv-side-hint">{spec.hint}</span>}
            </div>

            {spec?.args && (
              <div className="dv-side-block">
                <span className="dv-side-label">Arguments</span>
                <div className="dv-args">
                  {spec.args.map((label, i) => (
                    <label key={label} className="dv-arg">
                      <span className="dv-arg-label">{label}</span>
                      <input
                        type="text"
                        value={args[i] ?? ''}
                        onChange={(e) => {
                          const next = [...args];
                          next[i] = e.target.value;
                          setArgs(next);
                        }}
                      />
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="dv-footer">
          <button type="button" className="dv-cancel" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="dv-add"
            onClick={handleAdd}
            disabled={!selected}
          >
            {isExisting ? 'Replace' : 'Add dynamic value'}
          </button>
        </div>
      </div>
    </div>
  );
}
