import { useEffect, useState } from 'react';
import { SyntheticForm } from './SyntheticForm';
import { TraceViewer } from './TraceViewer';
import { RestCheckViewer } from './RestCheckViewer';
import './SyntheticPanel.css';

function RunningIndicator({ run }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(Date.now() - run.startedAt), 100);
    return () => clearInterval(timer);
  }, [run.startedAt]);

  const message =
    run.mode === 'rest'
      ? 'Calling start endpoint & polling status probe…'
      : 'Injecting event & tracing flow…';

  return (
    <div className="running-card animate-fade-in">
      <svg
        className="running-spinner animate-spin"
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      >
        <circle cx="12" cy="12" r="9" opacity="0.25" />
        <path d="M21 12a9 9 0 0 0-9-9" />
      </svg>
      <span className="running-message">{message}</span>
      <span className="running-elapsed">{(elapsed / 1000).toFixed(1)}s</span>
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M10 4l-4 4 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function FlaskIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 2h4M6.5 2v4.2L3.2 12.3a1 1 0 0 0 .87 1.5h7.85a1 1 0 0 0 .87-1.5L9.5 6.2V2"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SyntheticPanel() {
  const [results, setResults] = useState([]);
  const [run, setRun] = useState(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleResult = (result) => {
    setResults((prev) => [result, ...prev].slice(0, 10));
  };

  const handleRunStateChange = (running, mode) => {
    setRun(running ? { mode, startedAt: Date.now() } : null);
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className={`synthetic-panel ${sidebarOpen ? '' : 'sidebar-collapsed'}`}>
      {sidebarOpen ? (
        <aside className="panel-sidebar">
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Collapse panel"
            title="Collapse"
          >
            <ChevronLeftIcon />
          </button>
          <SyntheticForm onResult={handleResult} onRunStateChange={handleRunStateChange} />
        </aside>
      ) : (
        <button
          type="button"
          className="sidebar-rail"
          onClick={() => setSidebarOpen(true)}
          aria-label="Expand panel"
          title="Expand"
        >
          <ChevronRightIcon />
          <span className="sidebar-rail-icon">
            <FlaskIcon />
          </span>
          <span className="sidebar-rail-label">Inject Synthetic Transaction</span>
        </button>
      )}
      <div className="panel-main">
        <div className="results-header">
          <h3>Results</h3>
          {results.length > 0 && (
            <button className="clear-btn" onClick={clearResults}>
              Clear All
            </button>
          )}
        </div>
        {run && <RunningIndicator run={run} />}
        {results.length === 0 && !run ? (
          <div className="empty-results">
            <p>No synthetic transactions yet</p>
            <p className="hint">
              Inject a synthetic event to trace its flow through your system
            </p>
          </div>
        ) : (
          <div className="results-list">
            {results.map((result, index) =>
              result.mode === 'rest' ? (
                <RestCheckViewer key={index} result={result} />
              ) : (
                <TraceViewer key={index} result={result} />
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
