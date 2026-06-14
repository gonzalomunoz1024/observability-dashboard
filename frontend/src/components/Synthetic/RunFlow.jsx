import './RunFlow.css';

function StatusIcon({ kind }) {
  // kind: 'ok' | 'fail' | 'running' | 'pending'
  if (kind === 'running') {
    return (
      <svg className="run-flow-spin" width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
        <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (kind === 'ok') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5 8.5l2 2 4-4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (kind === 'fail') {
    return (
      <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
        <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" />
        <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5" strokeOpacity="0.4" />
    </svg>
  );
}

function nodeStateFor(kind, isInFlight) {
  if (isInFlight) return 'running';
  return kind;
}

function methodPath(method, url) {
  if (!url) return '—';
  try {
    const u = new URL(url);
    return `${method || ''} ${u.pathname}${u.search || ''}`.trim();
  } catch {
    return `${method || ''} ${url}`.trim();
  }
}

function FlowNode({ state, eyebrow, title, lines, accent }) {
  return (
    <div className={`flow-node flow-node-${state}`}>
      <div className="flow-node-head">
        <span className="flow-node-eyebrow">{eyebrow}</span>
        <span className={`flow-node-icon flow-node-icon-${state} ${accent ? `flow-icon-${accent}` : ''}`}>
          <StatusIcon kind={state} />
        </span>
      </div>
      <h4 className="flow-node-title">{title}</h4>
      {lines && lines.length > 0 && (
        <ul className="flow-node-lines">
          {lines.map((line, i) => (
            <li key={i}>
              {line.label && <span className="flow-line-label">{line.label}</span>}
              {line.value != null && <span className="flow-line-value">{line.value}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function FlowConnector({ state }) {
  return (
    <div className={`flow-connector flow-connector-${state}`}>
      <svg viewBox="0 0 60 12" preserveAspectRatio="none">
        <line x1="0" y1="6" x2="54" y2="6" strokeWidth="1.5" />
        <path d="M50 2 L56 6 L50 10" fill="none" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

/**
 * Visualizes a REST synthetic-transaction run as a 3-stage flow:
 *
 *   [ START ]  ───►  [ POLL ]  ───►  [ TERMINAL ]
 *
 * Each node turns green on success, red on failure, blue+spinning while
 * the stage is in flight, gray when not yet reached.
 */
export function RunFlow({ run }) {
  if (!run) return null;

  const result = run.result || {};
  const isRunning = run.status === 'running';
  const overall = run.status; // complete | error | timeout | running

  // Start node — fed by startStatusCode / startResponseSnippet.
  const startCode = result.startStatusCode;
  const startState = isRunning && startCode == null
    ? 'running'
    : startCode != null && startCode >= 200 && startCode < 300
      ? 'ok'
      : startCode != null && startCode !== 0
        ? 'fail'
        : 'pending';

  const startLines = [];
  if (run.startMethod || run.startUrl) {
    startLines.push({ value: methodPath(run.startMethod, run.startUrl) });
  }
  if (startCode != null && startCode !== 0) {
    startLines.push({ label: 'HTTP', value: startCode > 0 ? startCode : 'connection error' });
  }
  if (result.extractedId) {
    startLines.push({ label: 'id', value: result.extractedId });
  }

  // Probe node — fed by attempts / lastStatusCode / matchedValue.
  const attempts = result.attempts || 0;
  let probeState;
  if (startState === 'pending' || startState === 'fail') probeState = 'pending';
  else if (isRunning) probeState = 'running';
  else if (overall === 'complete') probeState = 'ok';
  else if (overall === 'timeout') probeState = 'fail';
  else if (overall === 'error') probeState = attempts > 0 ? 'fail' : 'pending';
  else probeState = 'pending';

  const probeLines = [];
  if (attempts > 0) probeLines.push({ label: 'attempts', value: attempts });
  if (result.lastStatusCode != null && result.lastStatusCode > 0) {
    probeLines.push({ label: 'HTTP', value: result.lastStatusCode });
  }
  if (result.matchedValue) {
    probeLines.push({ label: 'matched', value: `"${result.matchedValue}"` });
  } else if (attempts > 0 && overall === 'running') {
    probeLines.push({ label: 'status', value: 'awaiting terminal value' });
  }

  // Terminal node — the overall outcome.
  let terminalState;
  if (overall === 'running') terminalState = 'pending';
  else if (overall === 'complete') terminalState = 'ok';
  else terminalState = 'fail';

  const terminalLines = [];
  if (overall === 'complete') {
    terminalLines.push({ label: 'outcome', value: 'COMPLETE' });
  } else if (overall === 'timeout') {
    terminalLines.push({ label: 'outcome', value: 'TIMEOUT' });
  } else if (overall === 'error') {
    terminalLines.push({ label: 'outcome', value: 'ERROR' });
  } else if (overall === 'running') {
    terminalLines.push({ label: 'status', value: 'in progress' });
  }
  if (run.elapsedMs != null) {
    terminalLines.push({ label: 'elapsed', value: run.elapsedMs >= 1000 ? `${(run.elapsedMs / 1000).toFixed(2)}s` : `${run.elapsedMs}ms` });
  }

  return (
    <div className="run-flow">
      <FlowNode
        state={startState}
        eyebrow="Start"
        title="Inject request"
        lines={startLines}
      />
      <FlowConnector state={startState === 'ok' ? 'ok' : startState === 'running' ? 'running' : 'pending'} />
      <FlowNode
        state={probeState}
        eyebrow="Probe"
        title="Poll status"
        lines={probeLines}
      />
      <FlowConnector state={probeState === 'ok' ? 'ok' : probeState === 'running' ? 'running' : 'pending'} />
      <FlowNode
        state={terminalState}
        eyebrow="Terminal"
        title={overall === 'complete' ? 'Completed' : overall === 'running' ? 'In flight' : overall === 'timeout' ? 'Timed out' : 'Errored'}
        lines={terminalLines}
      />
    </div>
  );
}
