import { useEffect, useMemo, useState } from 'react';
import { probeRequest } from '../../utils/synthetic';
import { JsonEditor } from './JsonEditor';
import './IdPathPicker.css';

const SAFE_KEY = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function buildPath(segments) {
  let out = '$';
  for (const seg of segments) {
    if (typeof seg === 'number') {
      out += `[${seg}]`;
    } else if (SAFE_KEY.test(seg)) {
      out += `.${seg}`;
    } else {
      out += `['${seg.replace(/'/g, "\\'")}']`;
    }
  }
  return out;
}

function evaluatePath(value, path) {
  if (!path || !path.startsWith('$')) return { error: 'Path must start with $' };
  const tokens = [];
  let i = 1;
  while (i < path.length) {
    const c = path[i];
    if (c === '.') {
      let end = i + 1;
      while (end < path.length && !'.[]'.includes(path[end])) end++;
      const key = path.slice(i + 1, end);
      if (!key) return { error: `Empty key at position ${i}` };
      tokens.push(key);
      i = end;
    } else if (c === '[') {
      const close = path.indexOf(']', i);
      if (close === -1) return { error: 'Missing closing ]' };
      let inner = path.slice(i + 1, close).trim();
      if (inner.startsWith("'") && inner.endsWith("'")) {
        tokens.push(inner.slice(1, -1));
      } else if (inner.startsWith('"') && inner.endsWith('"')) {
        tokens.push(inner.slice(1, -1));
      } else if (/^-?\d+$/.test(inner)) {
        tokens.push(parseInt(inner, 10));
      } else {
        return { error: `Invalid index: ${inner}` };
      }
      i = close + 1;
    } else {
      return { error: `Unexpected character '${c}' at ${i}` };
    }
  }

  let cur = value;
  for (const t of tokens) {
    if (cur == null) return { error: 'Path went past null' };
    if (typeof t === 'number') {
      if (!Array.isArray(cur)) return { error: `Expected array at [${t}]` };
      cur = cur[t];
    } else {
      if (typeof cur !== 'object' || Array.isArray(cur)) {
        return { error: `Expected object at .${t}` };
      }
      cur = cur[t];
    }
  }
  return { value: cur };
}

function valuePreview(value) {
  if (value === null) return 'null';
  if (value === undefined) return '—';
  if (typeof value === 'string') return `"${value}"`;
  if (Array.isArray(value)) return `Array(${value.length})`;
  if (typeof value === 'object') return `{ ${Object.keys(value).length} keys }`;
  return String(value);
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

function SendIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4.5 2.7a.5.5 0 0 1 .76-.43l8.4 5.3a.5.5 0 0 1 0 .85l-8.4 5.3a.5.5 0 0 1-.76-.42V2.7z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function JsonNode({ data, segments, selectedPath, onPick, depth }) {
  const path = buildPath(segments);
  const isSelected = selectedPath === path;
  const [open, setOpen] = useState(depth < 2);

  if (data === null || data === undefined) {
    return (
      <button
        type="button"
        className={`json-row ${isSelected ? 'json-row-selected' : ''}`}
        onClick={() => onPick(path)}
        style={{ paddingLeft: `${depth * 14 + 12}px` }}
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
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
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
          style={{ paddingLeft: `${depth * 14 + 12}px` }}
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
          <span className="json-value json-value-meta">{`{ ${entries.length} ${entries.length === 1 ? 'key' : 'keys'} }`}</span>
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
      style={{ paddingLeft: `${depth * 14 + 12}px` }}
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

export function IdPathPicker({ open, request, value, onChange, onClose, headers }) {
  const [sending, setSending] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState(null);
  const [pathInput, setPathInput] = useState(value || '');
  const [bodyOpen, setBodyOpen] = useState(true);

  useEffect(() => {
    if (open) setPathInput(value || '');
  }, [open, value]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const parsedBody = useMemo(() => {
    if (!response?.body) return null;
    try {
      return JSON.parse(response.body);
    } catch {
      return null;
    }
  }, [response]);

  const preview = useMemo(() => {
    if (parsedBody == null) return null;
    if (!pathInput) return null;
    return evaluatePath(parsedBody, pathInput);
  }, [parsedBody, pathInput]);

  const handleSend = async () => {
    if (!request.url) {
      setError('Set a Start Endpoint URL first.');
      return;
    }
    setError(null);
    setSending(true);
    try {
      const result = await probeRequest({
        url: request.url,
        method: request.method,
        body: request.body,
        headers: headers,
        dynamicFields: request.dynamicFields || [],
      });
      setResponse(result);
      if (result.error) setError(result.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handlePick = (path) => {
    setPathInput(path);
  };

  const handleApply = () => {
    onChange(pathInput.trim());
    onClose();
  };

  if (!open) return null;

  const statusOk = response && response.statusCode >= 200 && response.statusCode < 300;
  const statusBadgeClass = !response
    ? ''
    : statusOk
      ? 'status-badge-ok'
      : response.statusCode < 0
        ? 'status-badge-err'
        : 'status-badge-warn';

  return (
    <div className="id-picker-overlay" onClick={onClose}>
      <div className="id-picker-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="id-picker-header">
          <div className="id-picker-title-group">
            <span className="id-picker-eyebrow">Status Probe</span>
            <h2 className="id-picker-title">Pick ID from Start Response</h2>
          </div>
          <button
            type="button"
            className="id-picker-close"
            onClick={onClose}
            aria-label="Close"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="id-picker-request">
          <span className="request-method">{request.method || 'POST'}</span>
          <span className="request-url" title={request.url}>{request.url || '(no URL set)'}</span>
          <button
            type="button"
            className="request-send-btn"
            onClick={handleSend}
            disabled={sending || !request.url}
          >
            {sending ? <Spinner /> : <SendIcon />}
            <span>{sending ? 'Sending…' : response ? 'Resend' : 'Send Start Request'}</span>
          </button>
        </div>

        {request.body != null && (
          <div className="id-picker-body-preview">
            <button
              type="button"
              className="body-preview-toggle"
              onClick={() => setBodyOpen((o) => !o)}
              aria-expanded={bodyOpen}
            >
              <ChevronIcon open={bodyOpen} />
              <span className="body-preview-label">Request body</span>
              <span className="body-preview-summary">
                {request.body.trim().length} chars
              </span>
            </button>
            {bodyOpen && (
              <div className="body-preview-editor">
                <JsonEditor value={request.body} readOnly height={160} />
              </div>
            )}
          </div>
        )}

        <div className="id-picker-body">
          <div className="id-picker-response">
            <div className="response-meta">
              <span className="response-label">Response</span>
              {response && (
                <>
                  <span className={`status-badge ${statusBadgeClass}`}>
                    {response.statusCode < 0 ? 'Error' : response.statusCode}
                  </span>
                  <span className="response-elapsed">{response.elapsedTime}ms</span>
                </>
              )}
            </div>

            {!response && !sending && (
              <div className="response-empty">
                <p>Send the start request to inspect the response.</p>
                <p className="hint">Click any field below to set its JSONPath.</p>
              </div>
            )}

            {sending && (
              <div className="response-empty">
                <Spinner />
                <p className="hint">Calling start endpoint…</p>
              </div>
            )}

            {response && (
              parsedBody !== null ? (
                <div className="json-tree">
                  <JsonNode
                    data={parsedBody}
                    segments={[]}
                    selectedPath={pathInput}
                    onPick={handlePick}
                    depth={0}
                  />
                </div>
              ) : (
                <div className="response-raw">
                  <span className="raw-tag">Raw (non-JSON)</span>
                  <JsonEditor
                    value={response.body || response.error || '(empty body)'}
                    language="plaintext"
                    readOnly
                    height="100%"
                  />
                </div>
              )
            )}
          </div>

          <div className="id-picker-side">
            <label className="side-label" htmlFor="idPickerPath">JSONPath</label>
            <input
              id="idPickerPath"
              className="side-input"
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="$.transactionId"
              spellCheck={false}
            />

            <div className="side-preview">
              <span className="preview-label">Extracted value</span>
              {!parsedBody ? (
                <span className="preview-empty">Send a request to preview.</span>
              ) : !pathInput ? (
                <span className="preview-empty">Click a field or type a path.</span>
              ) : preview?.error ? (
                <span className="preview-error">{preview.error}</span>
              ) : preview?.value === undefined ? (
                <span className="preview-empty">No match.</span>
              ) : (
                <code className="preview-value">{valuePreview(preview.value)}</code>
              )}
            </div>

            {error && <div className="side-error">{error}</div>}
          </div>
        </div>

        <div className="id-picker-footer">
          <button type="button" className="footer-cancel" onClick={onClose}>
            Cancel
          </button>
          <button
            type="button"
            className="footer-apply"
            onClick={handleApply}
            disabled={!pathInput.trim()}
          >
            Use this path
          </button>
        </div>
      </div>
    </div>
  );
}
