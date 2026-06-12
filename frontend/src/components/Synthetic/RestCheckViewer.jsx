import { useState } from 'react';
import './RestCheckViewer.css';

function prettyJson(text) {
  if (!text) return null;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

function StatusIcon({ status }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 13,
    height: 13,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2.5,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  switch (status) {
    case 'complete':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="m8.5 12.5 2.5 2.5 4.5-5.5" />
        </svg>
      );
    case 'timeout':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 7v5l3 2" />
        </svg>
      );
    case 'error':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
          <path d="M12 8v5" />
          <path d="M12 16.5h.01" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" />
        </svg>
      );
  }
}

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // clipboard unavailable (insecure context) — silently no-op
    }
  };

  return (
    <button
      type="button"
      className="copy-btn"
      onClick={handleCopy}
      title="Copy to clipboard"
    >
      {copied ? (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="m5 13 4 4 10-10" />
        </svg>
      ) : (
        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="11" height="11" rx="2" />
          <path d="M5 15V5a2 2 0 0 1 2-2h10" />
        </svg>
      )}
      <span>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  );
}

export function RestCheckViewer({ result }) {
  if (!result) return null;

  const { request, check } = result;
  const lastResponse = prettyJson(check.lastResponseSnippet);
  const startResponse = prettyJson(check.startResponseSnippet);

  return (
    <div className="rest-check-viewer">
      <div className="check-header">
        <h3>REST Transaction Check</h3>
        <div className="check-header-chips">
          <span className="elapsed-chip">
            <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="9" />
              <path d="M12 7v5l3 2" />
            </svg>
            {check.elapsedTime}ms
          </span>
          <span className={`check-status status-${check.status}`}>
            <StatusIcon status={check.status} /> {check.status}
          </span>
        </div>
      </div>

      <div className="check-meta">
        <div className="meta-item">
          <span className="meta-label">Start Endpoint</span>
          <code className="meta-value">
            {request.method} {request.startUrl}
          </code>
        </div>
        {check.extractedId && (
          <div className="meta-item">
            <span className="meta-label">Extracted ID</span>
            <code className="meta-value">{check.extractedId}</code>
          </div>
        )}
        <div className="meta-item">
          <span className="meta-label">Attempts</span>
          <span className="meta-value">{check.attempts}</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Elapsed Time</span>
          <span className="meta-value">{check.elapsedTime}ms</span>
        </div>
        {result.timestamp && (
          <div className="meta-item">
            <span className="meta-label">Started At</span>
            <span className="meta-value">{new Date(result.timestamp).toLocaleString()}</span>
          </div>
        )}
      </div>

      <div className="terminal-condition">
        <span className="condition-path">{request.statusJsonPath}</span>
        <span className="condition-operator">=</span>
        <span className="condition-value">{request.expectedStatusValue}</span>
        {check.status === 'complete' && (
          <span className="condition-matched">matched “{check.matchedValue}”</span>
        )}
      </div>

      {check.error && <div className="check-error">{check.error}</div>}

      {check.lastResponseSnippet && (
        <div className="response-section">
          <div className="response-head">
            <h4>
              Last Checker Response{' '}
              {check.lastStatusCode > 0 && (
                <span className="http-code">HTTP {check.lastStatusCode}</span>
              )}
            </h4>
            <CopyButton text={lastResponse} />
          </div>
          <pre className="response-body">{lastResponse}</pre>
        </div>
      )}

      {check.startResponseSnippet && (
        <details className="response-section">
          <summary>
            Start Response{' '}
            {check.startStatusCode > 0 && (
              <span className="http-code">HTTP {check.startStatusCode}</span>
            )}
          </summary>
          <div className="response-detail-body">
            <div className="response-head response-head-detail">
              <CopyButton text={startResponse} />
            </div>
            <pre className="response-body">{startResponse}</pre>
          </div>
        </details>
      )}
    </div>
  );
}
