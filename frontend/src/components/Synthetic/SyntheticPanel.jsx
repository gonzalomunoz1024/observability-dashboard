import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  listTransactions,
  deleteTransaction,
  runTransaction,
  listRuns,
  getRun,
} from '../../utils/synthetic';
import { TransactionEditor } from './TransactionEditor';
import { RunFlow } from './RunFlow';
import { JsonEditor } from './JsonEditor';
import './SyntheticPanel.css';

const RUNS_POLL_MS = 2000;
const TX_POLL_MS = 5000;

function PlusIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M8 3v10M3 8h10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4.5 2.7a.5.5 0 0 1 .76-.43l8.4 5.3a.5.5 0 0 1 0 .85l-8.4 5.3a.5.5 0 0 1-.76-.42V2.7z" />
    </svg>
  );
}

function PencilIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13l-3 1 1-3 8.5-8.5z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M3 4h10M6 4V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V4M4.5 4l.5 9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1l.5-9"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StatusPill({ status }) {
  if (!status) return <span className="status-pill status-unknown">—</span>;
  return <span className={`status-pill status-${status}`}>{status}</span>;
}

function formatRelative(iso) {
  if (!iso) return '—';
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'soon';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function formatUntil(iso) {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'due';
  const sec = Math.floor(ms / 1000);
  if (sec < 60) return `in ${sec}s`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `in ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `in ${hr}h`;
  return `in ${Math.floor(hr / 24)}d`;
}

function formatInterval(seconds) {
  if (!seconds) return 'Manual';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)}h`;
  return `${Math.round(seconds / 86400)}d`;
}

function formatDuration(ms) {
  if (ms == null) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function SyntheticPanel() {
  const [transactions, setTransactions] = useState([]);
  const [runs, setRuns] = useState([]);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [error, setError] = useState(null);
  const [runningIds, setRunningIds] = useState(() => new Set());

  const fetchTransactions = useCallback(async () => {
    try {
      const data = await listTransactions();
      setTransactions(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const fetchRuns = useCallback(async () => {
    try {
      const data = await listRuns({ limit: 50 });
      setRuns(data);
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    fetchTransactions();
    const id = setInterval(fetchTransactions, TX_POLL_MS);
    return () => clearInterval(id);
  }, [fetchTransactions]);

  useEffect(() => {
    fetchRuns();
    const id = setInterval(fetchRuns, RUNS_POLL_MS);
    return () => clearInterval(id);
  }, [fetchRuns]);

  useEffect(() => {
    if (selectedRunId == null) {
      setSelectedRun(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const data = await getRun(selectedRunId);
        if (!cancelled) setSelectedRun(data);
      } catch (err) {
        if (!cancelled) setError(err.message);
      }
    };
    load();
    const id = setInterval(load, RUNS_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [selectedRunId]);

  const handleNew = () => {
    setEditing(null);
    setEditorOpen(true);
  };

  const handleEdit = (tx) => {
    setEditing(tx);
    setEditorOpen(true);
  };

  const handleDelete = async (tx) => {
    if (!window.confirm(`Delete "${tx.name}"?`)) return;
    try {
      await deleteTransaction(tx.id);
      await fetchTransactions();
      await fetchRuns();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleRun = async (tx) => {
    setRunningIds((prev) => new Set(prev).add(tx.id));
    try {
      await runTransaction(tx.id);
      await fetchRuns();
      await fetchTransactions();
    } catch (err) {
      setError(err.message);
    } finally {
      setRunningIds((prev) => {
        const next = new Set(prev);
        next.delete(tx.id);
        return next;
      });
    }
  };

  const handleSaved = async () => {
    await fetchTransactions();
  };

  const handleRowClick = (run) => {
    setSelectedRunId(run.id);
  };

  const summary = useMemo(() => {
    const total = transactions.length;
    const enabled = transactions.filter((t) => t.enabled).length;
    const failing = transactions.filter((t) => t.lastStatus === 'error' || t.lastStatus === 'timeout').length;
    return { total, enabled, failing };
  }, [transactions]);

  return (
    <div className="studio-panel">
      <div className="studio-header">
        <div>
          <h2 className="studio-title">Synthetic Transaction Studio</h2>
          <p className="studio-subtitle">
            Author transactions once. Schedule, run, and watch them flow in real time.
          </p>
        </div>
        <div className="studio-header-actions">
          <button type="button" className="studio-primary-btn" onClick={handleNew}>
            <PlusIcon />
            <span>New Transaction</span>
          </button>
        </div>
      </div>

      <div className="studio-summary">
        <div className="summary-item">
          <span className="summary-count">{summary.total}</span>
          <span className="summary-label">Saved</span>
        </div>
        <div className="summary-item summary-enabled">
          <span className="summary-count">{summary.enabled}</span>
          <span className="summary-label">On schedule</span>
        </div>
        <div className="summary-item summary-failing">
          <span className="summary-count">{summary.failing}</span>
          <span className="summary-label">Failing</span>
        </div>
      </div>

      {error && (
        <div className="studio-error">
          {error}
          <button type="button" onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <section className="studio-section">
        <div className="section-head">
          <h3 className="section-title">Library</h3>
          <span className="section-count">{transactions.length}</span>
        </div>

        {transactions.length === 0 ? (
          <div className="empty-state">
            <p>No synthetic transactions yet.</p>
            <button type="button" className="empty-state-cta" onClick={handleNew}>
              Author your first one
            </button>
          </div>
        ) : (
          <div className="table-wrap">
            <table className="studio-table">
              <thead>
                <tr>
                  <th className="col-name">Name</th>
                  <th className="col-mode">Mode</th>
                  <th className="col-schedule">Schedule</th>
                  <th className="col-status">Last Status</th>
                  <th className="col-next">Next Run</th>
                  <th className="col-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((tx) => {
                  const running = runningIds.has(tx.id);
                  return (
                    <tr key={tx.id}>
                      <td className="col-name">
                        <button className="row-name-btn" onClick={() => handleEdit(tx)}>
                          {tx.name}
                        </button>
                      </td>
                      <td className="col-mode">
                        <span className="mode-pill">{tx.mode?.toUpperCase()}</span>
                      </td>
                      <td className="col-schedule">
                        <span className="schedule-text">{formatInterval(tx.intervalSeconds)}</span>
                        {!tx.enabled && <span className="disabled-tag">paused</span>}
                      </td>
                      <td className="col-status">
                        <StatusPill status={tx.lastStatus} />
                      </td>
                      <td className="col-next">
                        {tx.enabled && tx.intervalSeconds ? formatUntil(tx.nextRunAt) : '—'}
                      </td>
                      <td className="col-actions">
                        <div className="row-actions">
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => handleRun(tx)}
                            disabled={running}
                            title="Run now"
                          >
                            <PlayIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => handleEdit(tx)}
                            title="Edit"
                          >
                            <PencilIcon />
                          </button>
                          <button
                            type="button"
                            className="icon-btn icon-btn-danger"
                            onClick={() => handleDelete(tx)}
                            title="Delete"
                          >
                            <TrashIcon />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="studio-section">
        <div className="section-head">
          <h3 className="section-title">Recent Runs</h3>
          <span className="section-count">{runs.length}</span>
          <span className="section-hint">Refreshing every {RUNS_POLL_MS / 1000}s</span>
        </div>

        {runs.length === 0 ? (
          <div className="empty-state">
            <p>No runs yet. Hit ▶ on a saved transaction to kick one off.</p>
          </div>
        ) : (
          <div className="runs-split">
            <ul className="runs-list">
              {runs.map((run) => {
                const isSel = selectedRunId === run.id;
                return (
                  <li key={run.id}>
                    <button
                      type="button"
                      className={`runs-list-item ${isSel ? 'runs-list-item-sel' : ''}`}
                      onClick={() => handleRowClick(run)}
                    >
                      <div className="runs-list-top">
                        <span className="runs-list-id">#{run.id}</span>
                        {run.status === 'running' ? (
                          <span className="status-pill status-running">
                            <span className="running-dot" /> running
                          </span>
                        ) : (
                          <StatusPill status={run.status} />
                        )}
                      </div>
                      <div className="runs-list-name">
                        {run.transactionName || `Transaction #${run.transactionId}`}
                      </div>
                      <div className="runs-list-meta">
                        <span>{formatRelative(run.startedAt)}</span>
                        <span className="runs-list-dot" />
                        <span>{formatDuration(run.elapsedMs)}</span>
                        <span className="runs-list-dot" />
                        <span>{run.triggerType}</span>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>

            <div className="runs-detail">
              <RunDetailPane run={selectedRun} runs={runs} selectedRunId={selectedRunId} transactions={transactions} />
            </div>
          </div>
        )}
      </section>

      <TransactionEditor
        open={editorOpen}
        editing={editing}
        onClose={() => setEditorOpen(false)}
        onSaved={handleSaved}
      />
    </div>
  );
}

function RunDetailPane({ run, runs, selectedRunId, transactions }) {
  if (selectedRunId == null) {
    return (
      <div className="runs-detail-empty">
        <p>Pick a run from the list to see its flow.</p>
      </div>
    );
  }
  // Prefer the live polled `run`, but fall back to the row from the list so
  // selection feels instant while the detail fetch is in flight.
  const r = run || runs.find((x) => x.id === selectedRunId);
  if (!r) {
    return <div className="runs-detail-empty"><p>Loading…</p></div>;
  }

  // Enrich the run with start/probe metadata pulled from the parent tx so the
  // flow nodes can show METHOD + path.
  const tx = transactions.find((t) => t.id === r.transactionId);
  const enriched = tx?.config
    ? { ...r, startMethod: tx.config.method, startUrl: tx.config.startUrl, probeUrl: tx.config.probeUrl }
    : r;

  const json = r.result ? JSON.stringify(r.result, null, 2) : null;

  return (
    <div className="runs-detail-body">
      <header className="runs-detail-head">
        <div className="runs-detail-title-group">
          <span className="runs-detail-eyebrow">Run #{r.id}</span>
          <h3 className="runs-detail-title">{r.transactionName || `Transaction #${r.transactionId}`}</h3>
        </div>
        {r.status === 'running' ? (
          <span className="status-pill status-running">
            <span className="running-dot" /> running
          </span>
        ) : (
          <StatusPill status={r.status} />
        )}
      </header>

      <RunFlow run={enriched} />

      <div className="runs-detail-meta">
        <div className="runs-detail-meta-item">
          <span className="meta-label">Trigger</span>
          <span className="meta-value">{r.triggerType}</span>
        </div>
        <div className="runs-detail-meta-item">
          <span className="meta-label">Started</span>
          <span className="meta-value">{r.startedAt ? new Date(r.startedAt).toLocaleString() : '—'}</span>
        </div>
        <div className="runs-detail-meta-item">
          <span className="meta-label">Finished</span>
          <span className="meta-value">{r.finishedAt ? new Date(r.finishedAt).toLocaleString() : '—'}</span>
        </div>
        <div className="runs-detail-meta-item">
          <span className="meta-label">Duration</span>
          <span className="meta-value">{r.elapsedMs != null ? (r.elapsedMs >= 1000 ? `${(r.elapsedMs / 1000).toFixed(2)}s` : `${r.elapsedMs}ms`) : '—'}</span>
        </div>
      </div>

      {r.error && (
        <div className="runs-detail-error">
          <span className="meta-label">Error</span>
          <pre>{r.error}</pre>
        </div>
      )}

      <ResponsePanel
        title="Start response"
        statusCode={r.result?.startStatusCode}
        body={r.result?.startResponseSnippet}
      />
      <ResponsePanel
        title="Last probe response"
        statusCode={r.result?.lastStatusCode}
        body={r.result?.lastResponseSnippet}
        meta={r.result?.attempts ? `attempt ${r.result.attempts}` : null}
      />

      {json && (
        <details className="runs-detail-raw">
          <summary>Raw result</summary>
          <pre>{json}</pre>
        </details>
      )}
    </div>
  );
}

function ResponsePanel({ title, statusCode, body, meta }) {
  if (!body && (statusCode == null || statusCode === 0)) return null;

  const isJson = (() => {
    if (!body) return false;
    const t = body.trim();
    if (!t.startsWith('{') && !t.startsWith('[')) return false;
    try { JSON.parse(t); return true; } catch { return false; }
  })();

  const formatted = isJson ? JSON.stringify(JSON.parse(body), null, 2) : (body ?? '');
  const language = isJson ? 'json' : 'plaintext';

  let statusClass = '';
  if (statusCode != null) {
    if (statusCode < 0) statusClass = 'response-code-err';
    else if (statusCode >= 200 && statusCode < 300) statusClass = 'response-code-ok';
    else statusClass = 'response-code-warn';
  }

  return (
    <details className="runs-detail-response" open={statusCode != null && statusCode >= 400}>
      <summary>
        <span className="response-title">{title}</span>
        {statusCode != null && statusCode !== 0 && (
          <span className={`response-code ${statusClass}`}>
            {statusCode < 0 ? 'connection error' : `HTTP ${statusCode}`}
          </span>
        )}
        {meta && <span className="response-meta">{meta}</span>}
      </summary>
      {body && (
        <div className="runs-detail-response-body">
          <JsonEditor value={formatted} readOnly height={260} language={language} />
        </div>
      )}
    </details>
  );
}
