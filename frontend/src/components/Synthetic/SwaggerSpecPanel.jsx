import { useState } from 'react';
import { parseSpec } from '../../utils/synthetic';
import './SwaggerSpecPanel.css';

const METHOD_COLORS = {
  GET: 'method-get',
  POST: 'method-post',
  PUT: 'method-put',
  PATCH: 'method-patch',
  DELETE: 'method-delete',
  HEAD: 'method-head',
  OPTIONS: 'method-options',
};

function opKey(op) {
  return `${op.method} ${op.path}`;
}

export function SwaggerSpecPanel({ onPickStart, onPickProbe, startOpKey, probeOpKey }) {
  const [source, setSource] = useState('url');
  const [value, setValue] = useState('');
  const [spec, setSpec] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');
  const [collapsed, setCollapsed] = useState(false);

  const handleLoad = async () => {
    if (!value.trim()) {
      setError('Paste a Swagger URL or JSON first.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await parseSpec({ source, value });
      setSpec(result);
      setCollapsed(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const operations = spec?.operations ?? [];
  const filtered = filter.trim()
    ? operations.filter((op) =>
        `${op.method} ${op.path} ${op.summary || ''} ${op.operationId || ''}`
          .toLowerCase()
          .includes(filter.toLowerCase()))
    : operations;

  return (
    <div className="spec-panel">
      <div className="spec-panel-head">
        <div className="spec-panel-title-group">
          <span className="spec-panel-eyebrow">Source of truth</span>
          <h3 className="spec-panel-title">
            {spec
              ? `${spec.title || 'API'}${spec.version ? ` · v${spec.version}` : ''}`
              : 'Load from Swagger / OpenAPI'}
          </h3>
        </div>
        {spec && (
          <button
            type="button"
            className="spec-panel-collapse"
            onClick={() => setCollapsed((c) => !c)}
          >
            {collapsed ? 'Show input' : 'Hide input'}
          </button>
        )}
      </div>

      {(!spec || !collapsed) && (
        <div className="spec-panel-input">
          <div className="spec-source-tabs" role="radiogroup" aria-label="Spec source">
            <button
              type="button"
              className={`spec-source-tab ${source === 'url' ? 'is-active' : ''}`}
              onClick={() => setSource('url')}
            >
              URL
            </button>
            <button
              type="button"
              className={`spec-source-tab ${source === 'json' ? 'is-active' : ''}`}
              onClick={() => setSource('json')}
            >
              Paste JSON / YAML
            </button>
          </div>

          {source === 'url' ? (
            <input
              type="url"
              className="spec-source-input"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder="https://api.example.com/v3/api-docs"
            />
          ) : (
            <textarea
              className="spec-source-textarea"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder='{"openapi": "3.0.0", ...}'
              rows={6}
              spellCheck={false}
            />
          )}

          <div className="spec-source-actions">
            {error && <span className="spec-source-error">{error}</span>}
            <button
              type="button"
              className="spec-source-load"
              onClick={handleLoad}
              disabled={loading}
            >
              {loading ? 'Loading…' : 'Load operations'}
            </button>
          </div>
        </div>
      )}

      {spec && (
        <div className="spec-operations">
          <div className="spec-operations-head">
            <input
              type="text"
              className="spec-operations-filter"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder={`Filter ${operations.length} operations…`}
            />
          </div>
          {filtered.length === 0 ? (
            <p className="spec-operations-empty">No operations match.</p>
          ) : (
            <ul className="spec-operations-list">
              {filtered.map((op) => {
                const key = opKey(op);
                const isStart = key === startOpKey;
                const isProbe = key === probeOpKey;
                return (
                  <li key={key} className={`spec-op ${isStart || isProbe ? 'is-bound' : ''}`}>
                    <div className="spec-op-line">
                      <span className={`spec-op-method ${METHOD_COLORS[op.method] || ''}`}>
                        {op.method}
                      </span>
                      <span className="spec-op-path" title={op.path}>{op.path}</span>
                      {op.summary && <span className="spec-op-summary" title={op.summary}>{op.summary}</span>}
                    </div>
                    <div className="spec-op-actions">
                      {isStart && <span className="spec-op-tag spec-op-tag-start">Start</span>}
                      {isProbe && <span className="spec-op-tag spec-op-tag-probe">Probe</span>}
                      <button
                        type="button"
                        className="spec-op-use"
                        onClick={() => onPickStart?.(op, spec)}
                      >
                        Use as Start
                      </button>
                      <button
                        type="button"
                        className="spec-op-use spec-op-use-secondary"
                        onClick={() => onPickProbe?.(op, spec)}
                      >
                        Use as Probe
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
