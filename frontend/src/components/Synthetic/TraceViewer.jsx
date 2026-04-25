import './TraceViewer.css';

export function TraceViewer({ result }) {
  if (!result) return null;

  const { injection, trace } = result;

  const getStepStatus = (step) => {
    if (trace.completedSteps.includes(step)) return 'completed';
    if (trace.missingSteps.includes(step)) return 'missing';
    return 'pending';
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'complete':
        return '✓';
      case 'partial':
        return '⚠';
      case 'timeout':
        return '✕';
      default:
        return '○';
    }
  };

  return (
    <div className="trace-viewer">
      <div className="trace-header">
        <h3>Transaction Trace</h3>
        <span className={`trace-status status-${trace.status}`}>
          {getStatusIcon(trace.status)} {trace.status}
        </span>
      </div>

      <div className="trace-meta">
        <div className="meta-item">
          <span className="meta-label">Correlation ID</span>
          <code className="meta-value">{injection.correlationId}</code>
        </div>
        <div className="meta-item">
          <span className="meta-label">Elapsed Time</span>
          <span className="meta-value">{trace.elapsedTime}ms</span>
        </div>
        <div className="meta-item">
          <span className="meta-label">Started At</span>
          <span className="meta-value">{new Date(injection.timestamp).toLocaleString()}</span>
        </div>
      </div>

      <div className="flow-visualization">
        <h4>Event Flow</h4>
        <div className="flow-steps">
          {trace.expectedFlow.map((step, index) => (
            <div key={step} className="flow-step-container">
              <div className={`flow-step step-${getStepStatus(step)}`}>
                <span className="step-indicator" />
                <span className="step-name">{step}</span>
              </div>
              {index < trace.expectedFlow.length - 1 && (
                <div className={`flow-arrow arrow-${getStepStatus(trace.expectedFlow[index + 1])}`}>
                  →
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {trace.foundEvents.length > 0 && (
        <div className="events-list">
          <h4>Found Events ({trace.foundEvents.length})</h4>
          <div className="events-table">
            <div className="events-header">
              <span>Event Type</span>
              <span>Timestamp</span>
              <span>Source</span>
            </div>
            {trace.foundEvents.map((event, index) => (
              <div key={index} className="event-row">
                <span className="event-type">{event.eventType}</span>
                <span className="event-time">
                  {new Date(event.timestamp).toLocaleTimeString()}
                </span>
                <span className="event-source">{event.source || '-'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {trace.status !== 'complete' && trace.missingSteps.length > 0 && (
        <div className="missing-steps">
          <h4>Missing Steps</h4>
          <div className="missing-list">
            {trace.missingSteps.map((step) => (
              <span key={step} className="missing-step">
                {step}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
