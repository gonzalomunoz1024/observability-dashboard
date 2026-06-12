import './RestCheckViewer.css';

function prettyJson(text) {
  if (!text) return null;
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export function RestCheckViewer({ result }) {
  if (!result) return null;

  const { request, check } = result;

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return '✓';
      case 'error':
        return '⚠';
      case 'timeout':
        return '✕';
      default:
        return '○';
    }
  };

  return (
    <div className="rest-check-viewer">
      <div className="check-header">
        <h3>REST Transaction Check</h3>
        <span className={`check-status status-${check.status}`}>
          {getStatusIcon(check.status)} {check.status}
        </span>
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
          <h4>
            Last Checker Response{' '}
            {check.lastStatusCode > 0 && (
              <span className="http-code">HTTP {check.lastStatusCode}</span>
            )}
          </h4>
          <pre className="response-body">{prettyJson(check.lastResponseSnippet)}</pre>
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
          <pre className="response-body">{prettyJson(check.startResponseSnippet)}</pre>
        </details>
      )}
    </div>
  );
}
