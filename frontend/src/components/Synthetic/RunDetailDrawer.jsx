import { useEffect } from 'react';
import './RunDetailDrawer.css';

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function StatusPill({ status }) {
  return <span className={`run-status-pill status-${status}`}>{status}</span>;
}

function formatTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString();
}

function formatDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function ResultBlock({ run }) {
  if (run.status === 'running') {
    return <p className="result-placeholder">Run in progress — refresh in a moment.</p>;
  }
  if (run.error) {
    return (
      <div className="result-section">
        <span className="result-label">Error</span>
        <pre className="result-error">{run.error}</pre>
      </div>
    );
  }
  if (!run.result) {
    return <p className="result-placeholder">No result captured.</p>;
  }

  const json = JSON.stringify(run.result, null, 2);

  return (
    <>
      {run.mode === 'rest' && <RestSummary result={run.result} />}
      {run.mode === 'kafka' && <KafkaSummary result={run.result} />}
      <div className="result-section">
        <span className="result-label">Raw Result</span>
        <pre className="result-json">{json}</pre>
      </div>
    </>
  );
}

function RestSummary({ result }) {
  return (
    <div className="result-grid">
      {result.extractedId && (
        <div className="result-grid-item">
          <span className="grid-label">Extracted ID</span>
          <code className="grid-value">{result.extractedId}</code>
        </div>
      )}
      {result.attempts != null && (
        <div className="result-grid-item">
          <span className="grid-label">Probe Attempts</span>
          <span className="grid-value">{result.attempts}</span>
        </div>
      )}
      {result.lastStatusCode != null && result.lastStatusCode > 0 && (
        <div className="result-grid-item">
          <span className="grid-label">Last Probe Status</span>
          <span className="grid-value">{result.lastStatusCode}</span>
        </div>
      )}
      {result.matchedValue && (
        <div className="result-grid-item">
          <span className="grid-label">Matched Value</span>
          <code className="grid-value">{result.matchedValue}</code>
        </div>
      )}
    </div>
  );
}

function KafkaSummary({ result }) {
  return (
    <div className="result-grid">
      {result.correlationId && (
        <div className="result-grid-item">
          <span className="grid-label">Correlation ID</span>
          <code className="grid-value">{result.correlationId}</code>
        </div>
      )}
      {Array.isArray(result.completedSteps) && (
        <div className="result-grid-item">
          <span className="grid-label">Completed Steps</span>
          <span className="grid-value">{result.completedSteps.join(' → ') || '—'}</span>
        </div>
      )}
      {Array.isArray(result.missingSteps) && result.missingSteps.length > 0 && (
        <div className="result-grid-item">
          <span className="grid-label">Missing Steps</span>
          <span className="grid-value">{result.missingSteps.join(', ')}</span>
        </div>
      )}
    </div>
  );
}

export function RunDetailDrawer({ run, onClose }) {
  useEffect(() => {
    if (!run) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [run, onClose]);

  if (!run) return null;

  return (
    <div className="run-detail-overlay" onClick={onClose}>
      <div className="run-detail-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="run-detail-header">
          <div className="run-detail-title-group">
            <span className="run-detail-eyebrow">Run #{run.id}</span>
            <h2 className="run-detail-title">{run.transactionName || 'Synthetic Transaction'}</h2>
          </div>
          <button type="button" className="run-detail-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="run-detail-meta">
          <div className="meta-item">
            <span className="meta-label">Status</span>
            <StatusPill status={run.status} />
          </div>
          <div className="meta-item">
            <span className="meta-label">Trigger</span>
            <span className="meta-value">{run.triggerType}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Mode</span>
            <span className="meta-value">{run.mode || '—'}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Started</span>
            <span className="meta-value">{formatTime(run.startedAt)}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Duration</span>
            <span className="meta-value">{formatDuration(run.elapsedMs)}</span>
          </div>
        </div>

        <div className="run-detail-body">
          <ResultBlock run={run} />
        </div>
      </div>
    </div>
  );
}
