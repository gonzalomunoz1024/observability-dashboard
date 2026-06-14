import { useEffect, useMemo, useState } from 'react';
import { probeOnce } from '../../utils/synthetic';
import { JsonEditor } from './JsonEditor';
import { JsonTreeView } from './JsonTreeView';
import { evaluatePath, valuePreview, valueAsTerminal } from './jsonTree';
// Re-use the IdPathPicker styles — same slide-in drawer skeleton.
import './IdPathPicker.css';
import './TerminalPathPicker.css';

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

export function TerminalPathPicker({
  open,
  startRequest,
  probeUrl,
  idJsonPath,
  headers,
  statusJsonPath,
  expectedStatusValue,
  onChange,
  onClose,
}) {
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [pathInput, setPathInput] = useState(statusJsonPath || '$.status');
  const [valueInput, setValueInput] = useState(expectedStatusValue || '');

  useEffect(() => {
    if (!open) return;
    setPathInput(statusJsonPath || '$.status');
    setValueInput(expectedStatusValue || '');
    setResult(null);
    setError(null);
  }, [open, statusJsonPath, expectedStatusValue]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const parsedProbe = useMemo(() => {
    if (!result?.probe?.body) return null;
    try { return JSON.parse(result.probe.body); } catch { return null; }
  }, [result]);

  const pathPreview = useMemo(() => {
    if (parsedProbe == null || !pathInput) return null;
    return evaluatePath(parsedProbe, pathInput);
  }, [parsedProbe, pathInput]);

  const handleSend = async () => {
    if (!startRequest?.url) { setError('Set a Start Endpoint URL first.'); return; }
    if (!probeUrl) { setError('Set a Probe Endpoint URL first.'); return; }
    setSending(true);
    setError(null);
    try {
      const data = await probeOnce({
        startUrl: startRequest.url,
        method: startRequest.method,
        body: startRequest.body,
        headers,
        probeUrl,
        idJsonPath,
        dynamicFields: startRequest.dynamicFields || [],
      });
      setResult(data);
      if (data.error) setError(data.error);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const handlePickPath = (path) => {
    setPathInput(path);
    if (parsedProbe) {
      const evaluated = evaluatePath(parsedProbe, path);
      if (evaluated?.value !== undefined && evaluated.value !== null) {
        setValueInput(valueAsTerminal(evaluated.value));
      }
    }
  };

  const handleApply = () => {
    onChange({ statusJsonPath: pathInput.trim(), expectedStatusValue: valueInput });
    onClose();
  };

  const handleApplyPathOnly = () => {
    onChange({ statusJsonPath: pathInput.trim() });
    onClose();
  };

  if (!open) return null;

  const probe = result?.probe;
  const start = result?.start;
  const probeOk = probe && probe.statusCode >= 200 && probe.statusCode < 300;
  const probeBadgeClass = !probe ? ''
    : probeOk ? 'status-badge-ok'
    : probe.statusCode < 0 ? 'status-badge-err' : 'status-badge-warn';

  return (
    <div className="id-picker-overlay" onClick={onClose}>
      <div className="id-picker-drawer term-picker" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="id-picker-header">
          <div className="id-picker-title-group">
            <span className="id-picker-eyebrow">Status Probe</span>
            <h2 className="id-picker-title">Pick terminal key from Probe Response</h2>
          </div>
          <button type="button" className="id-picker-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="id-picker-request">
          <div className="term-picker-chain">
            <span className="term-picker-chain-segment">
              <span className="request-method">{startRequest?.method || 'POST'}</span>
              <span className="request-url" title={startRequest?.url}>{startRequest?.url || '(no start URL)'}</span>
            </span>
            <span className="term-picker-arrow">→</span>
            <span className="term-picker-chain-segment">
              <span className="request-method">GET</span>
              <span className="request-url" title={probeUrl}>{probeUrl || '(no probe URL)'}</span>
            </span>
          </div>
          <button
            type="button"
            className="request-send-btn"
            onClick={handleSend}
            disabled={sending || !startRequest?.url || !probeUrl}
          >
            {sending ? <Spinner /> : <SendIcon />}
            <span>{sending ? 'Sending…' : result ? 'Resend' : 'Send chain'}</span>
          </button>
        </div>

        <div className="id-picker-body">
          <div className="id-picker-response">
            <div className="response-meta">
              <span className="response-label">Probe response</span>
              {probe && (
                <>
                  <span className={`status-badge ${probeBadgeClass}`}>
                    {probe.statusCode < 0 ? 'Error' : probe.statusCode}
                  </span>
                  <span className="response-elapsed">{probe.elapsedTime}ms</span>
                </>
              )}
              {result?.extractedId && (
                <span className="term-picker-id">id: <code>{result.extractedId}</code></span>
              )}
            </div>

            {!result && !sending && (
              <div className="response-empty">
                <p>Send the chain to inspect the probe response.</p>
                <p className="hint">Start → extract id → call probe.</p>
              </div>
            )}

            {sending && (
              <div className="response-empty">
                <Spinner />
                <p className="hint">Running start → probe…</p>
              </div>
            )}

            {result && !probe && start && (
              <div className="response-raw">
                <span className="raw-tag">Chain stopped at start</span>
                <JsonEditor
                  value={start.body || start.error || '(empty)'}
                  language={(() => { try { JSON.parse(start.body); return 'json'; } catch { return 'plaintext'; } })()}
                  readOnly
                  height="100%"
                />
              </div>
            )}

            {result && probe && (
              parsedProbe !== null ? (
                <div className="json-tree">
                  <JsonTreeView
                    data={parsedProbe}
                    selectedPath={pathInput}
                    onPick={handlePickPath}
                  />
                </div>
              ) : (
                <div className="response-raw">
                  <span className="raw-tag">Raw (non-JSON)</span>
                  <JsonEditor
                    value={probe.body || probe.error || '(empty body)'}
                    language="plaintext"
                    readOnly
                    height="100%"
                  />
                </div>
              )
            )}
          </div>

          <div className="id-picker-side">
            <label className="side-label" htmlFor="termPickerPath">Status JSONPath</label>
            <input
              id="termPickerPath"
              className="side-input"
              type="text"
              value={pathInput}
              onChange={(e) => setPathInput(e.target.value)}
              placeholder="$.status"
              spellCheck={false}
            />

            <div className="side-preview">
              <span className="preview-label">Current value at path</span>
              {!parsedProbe ? (
                <span className="preview-empty">Send the chain to preview.</span>
              ) : !pathInput ? (
                <span className="preview-empty">Click a field or type a path.</span>
              ) : pathPreview?.error ? (
                <span className="preview-error">{pathPreview.error}</span>
              ) : pathPreview?.value === undefined ? (
                <span className="preview-empty">No match.</span>
              ) : (
                <code className="preview-value">{valuePreview(pathPreview.value)}</code>
              )}
            </div>

            <label className="side-label" htmlFor="termPickerValue">Terminal value</label>
            <input
              id="termPickerValue"
              className="side-input"
              type="text"
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
              placeholder="COMPLETED"
              spellCheck={false}
            />
            <span className="side-hint">
              Auto-filled with the current value when you click a field — replace with whatever
              your API uses to signal &quot;done&quot;.
            </span>

            {error && <div className="side-error">{error}</div>}
          </div>
        </div>

        <div className="id-picker-footer term-picker-footer">
          <button type="button" className="footer-cancel" onClick={onClose}>Cancel</button>
          <button
            type="button"
            className="footer-apply footer-apply-secondary"
            onClick={handleApplyPathOnly}
            disabled={!pathInput.trim()}
          >
            Use path only
          </button>
          <button
            type="button"
            className="footer-apply"
            onClick={handleApply}
            disabled={!pathInput.trim()}
          >
            Use path + value
          </button>
        </div>
      </div>
    </div>
  );
}
