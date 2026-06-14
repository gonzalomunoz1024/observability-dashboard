import { useEffect, useState } from 'react';
import {
  SyntheticForm,
  DEFAULT_KAFKA_CONFIG,
  DEFAULT_REST_CONFIG,
  jsonValidity,
} from './SyntheticForm';
import { SwaggerSpecPanel } from './SwaggerSpecPanel';
import { buildStartPatch, buildProbePatch, rebindIdPath } from './swaggerInference';
import { createTransaction, updateTransaction } from '../../utils/synthetic';
import './TransactionEditor.css';

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
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

function loadInitialState(editing) {
  if (!editing) {
    return {
      name: '',
      mode: 'rest',
      intervalSeconds: 900,
      enabled: true,
      kafka: { ...DEFAULT_KAFKA_CONFIG },
      rest: { ...DEFAULT_REST_CONFIG },
      headers: [],
    };
  }

  const config = editing.config || {};
  const mode = editing.mode || 'rest';
  const headers = config.headers
    ? Object.entries(config.headers).map(([key, value]) => ({ key, value: String(value) }))
    : [];

  const rest = mode === 'rest'
    ? {
        ...DEFAULT_REST_CONFIG,
        startUrl: config.startUrl || '',
        method: config.method || 'POST',
        body: config.body || '{}',
        probeUrl: config.probeUrl || '',
        idJsonPath: config.idJsonPath || '',
        statusJsonPath: config.statusJsonPath || '$.status',
        expectedStatusValue: config.expectedStatusValue || '',
        timeout: config.timeout || 30000,
        pollInterval: config.pollInterval || 1000,
        requestFields: Array.isArray(config.requestFields) ? config.requestFields : [],
        dynamicFields: Array.isArray(config.dynamicFields) ? config.dynamicFields : [],
      }
    : { ...DEFAULT_REST_CONFIG };

  const kafka = mode === 'kafka'
    ? {
        ...DEFAULT_KAFKA_CONFIG,
        topic: config.topic || '',
        eventType: config.eventType || '',
        expectedFlow: config.expectedFlow || '',
        timeout: config.timeout || 30000,
        payload: typeof config.payload === 'object'
          ? JSON.stringify(config.payload, null, 2)
          : (config.payload || '{}'),
      }
    : { ...DEFAULT_KAFKA_CONFIG };

  return {
    name: editing.name || '',
    mode,
    intervalSeconds: editing.intervalSeconds ?? 900,
    enabled: editing.enabled !== false,
    kafka,
    rest,
    headers,
  };
}

function buildConfigPayload(mode, rest, kafka, headers) {
  if (mode === 'rest') {
    const headerMap = headers.reduce((acc, h) => {
      if (h.key.trim()) acc[h.key.trim()] = h.value;
      return acc;
    }, {});
    return {
      startUrl: rest.startUrl.trim(),
      method: rest.method,
      body: rest.body,
      headers: headerMap,
      probeUrl: rest.probeUrl.trim(),
      idJsonPath: rest.idJsonPath.trim(),
      statusJsonPath: rest.statusJsonPath.trim(),
      expectedStatusValue: rest.expectedStatusValue.trim(),
      timeout: rest.timeout,
      pollInterval: rest.pollInterval,
      requestFields: rest.requestFields || [],
      dynamicFields: rest.dynamicFields || [],
    };
  }
  let payload = {};
  try {
    payload = kafka.payload.trim() ? JSON.parse(kafka.payload) : {};
  } catch { /* validated below */ }
  return {
    topic: kafka.topic.trim(),
    eventType: kafka.eventType.trim(),
    expectedFlow: kafka.expectedFlow.trim(),
    timeout: kafka.timeout,
    payload,
  };
}

function validate(state) {
  if (!state.name.trim()) return 'Name is required';
  if (state.intervalSeconds != null && state.intervalSeconds < 5) {
    return 'Interval must be at least 5 seconds';
  }
  if (state.mode === 'rest') {
    if (!state.rest.startUrl.trim()) return 'Start endpoint is required';
    if (!state.rest.probeUrl.trim()) return 'Probe endpoint is required';
    if (!state.rest.expectedStatusValue.trim()) return 'Terminal value is required';
    if (state.rest.probeUrl.includes('{{id}}') && !state.rest.idJsonPath.trim()) {
      return 'ID extraction path is required when probe URL uses {{id}}';
    }
    if (jsonValidity(state.rest.body) === 'invalid') return 'Request body is not valid JSON';
  } else {
    if (!state.kafka.topic.trim()) return 'Topic is required';
    if (!state.kafka.eventType.trim()) return 'Event type is required';
    if (!state.kafka.expectedFlow.trim()) return 'Expected flow is required';
    if (jsonValidity(state.kafka.payload) === 'invalid') return 'Payload is not valid JSON';
  }
  return null;
}

export function TransactionEditor({ open, editing, onClose, onSaved }) {
  const [state, setState] = useState(() => loadInitialState(editing));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [startOpKey, setStartOpKey] = useState(null);
  const [probeOpKey, setProbeOpKey] = useState(null);
  const [startOp, setStartOp] = useState(null);
  const [probeOp, setProbeOp] = useState(null);
  const [inference, setInference] = useState(null);

  useEffect(() => {
    if (open) {
      setState(loadInitialState(editing));
      setError(null);
      setStartOpKey(null);
      setProbeOpKey(null);
      setStartOp(null);
      setProbeOp(null);
      setInference(null);
    }
  }, [open, editing]);

  useEffect(() => {
    if (!inference) return;
    const timer = setTimeout(() => setInference(null), 6000);
    return () => clearTimeout(timer);
  }, [inference]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const update = (patch) => setState((prev) => ({ ...prev, ...patch }));

  const handleSave = async () => {
    const validationError = validate(state);
    if (validationError) {
      setError(validationError);
      return;
    }

    const payload = {
      name: state.name.trim(),
      mode: state.mode,
      config: buildConfigPayload(state.mode, state.rest, state.kafka, state.headers),
      intervalSeconds: state.intervalSeconds || null,
      enabled: state.enabled,
    };

    setSubmitting(true);
    setError(null);
    try {
      const result = editing
        ? await updateTransaction(editing.id, payload)
        : await createTransaction(payload);
      onSaved?.(result);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="tx-editor-overlay" onClick={onClose}>
      <div className="tx-editor-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="tx-editor-header">
          <div className="tx-editor-title-group">
            <span className="tx-editor-eyebrow">{editing ? 'Edit' : 'New'} Synthetic Transaction</span>
            <h2 className="tx-editor-title">{state.name.trim() || 'Untitled transaction'}</h2>
          </div>
          <button type="button" className="tx-editor-close" onClick={onClose} aria-label="Close">
            <CloseIcon />
          </button>
        </div>

        <div className="tx-editor-meta">
          <div className="meta-group meta-name">
            <label htmlFor="txName">Name</label>
            <input
              id="txName"
              type="text"
              value={state.name}
              onChange={(e) => update({ name: e.target.value })}
              placeholder="Order placement flow"
            />
          </div>
          <div className="meta-group">
            <label htmlFor="txInterval">Schedule</label>
            <select
              id="txInterval"
              value={state.intervalSeconds ?? ''}
              onChange={(e) => update({
                intervalSeconds: e.target.value === '' ? null : parseInt(e.target.value, 10),
              })}
            >
              <option value="">Manual only</option>
              <option value="60">Every 1 min</option>
              <option value="300">Every 5 min</option>
              <option value="900">Every 15 min</option>
              <option value="1800">Every 30 min</option>
              <option value="3600">Every 1 hour</option>
              <option value="21600">Every 6 hours</option>
              <option value="86400">Every 24 hours</option>
            </select>
          </div>
          <div className="meta-group meta-toggle">
            <label htmlFor="txEnabled">Enabled</label>
            <button
              id="txEnabled"
              type="button"
              role="switch"
              aria-checked={state.enabled}
              className={`toggle ${state.enabled ? 'toggle-on' : ''}`}
              onClick={() => update({ enabled: !state.enabled })}
            >
              <span className="toggle-knob" />
            </button>
          </div>
        </div>

        <div className="tx-editor-body">
          {state.mode === 'rest' && (
            <SwaggerSpecPanel
              startOpKey={startOpKey}
              probeOpKey={probeOpKey}
              onPickStart={(op, spec) => {
                setStartOpKey(`${op.method} ${op.path}`);
                setStartOp(op);
                let { rest: nextRest, inference: info } = buildStartPatch(state.rest, op, spec);
                // If a probe was already chosen, re-derive idJsonPath from the new start response.
                if (probeOp) {
                  nextRest = rebindIdPath(nextRest, probeOp, op);
                }
                update({ rest: nextRest });
                setInference(info);
              }}
              onPickProbe={(op, spec) => {
                setProbeOpKey(`${op.method} ${op.path}`);
                setProbeOp(op);
                const { rest: nextRest, inference: info } = buildProbePatch(state.rest, op, spec, startOp);
                update({ rest: nextRest });
                setInference(info);
              }}
            />
          )}

          {inference && (
            <div className="tx-inference" role="status" aria-live="polite">
              <span className="tx-inference-eyebrow">Auto-filled from spec</span>
              <span className="tx-inference-body">
                {inference.kind === 'start' && (
                  <>
                    <code>{inference.operationId}</code> as Start —
                    {' '}method, URL, body, and Request Shape populated.
                  </>
                )}
                {inference.kind === 'probe' && (
                  <>
                    <code>{inference.operationId}</code> as Probe —
                    {inference.fields.probeUrl && ' probe URL'}
                    {inference.fields.statusJsonPath && ', status path'}
                    {inference.fields.expectedStatusValue && ', terminal value'}
                    {inference.fields.idJsonPath && ', ID extraction'}
                    {inference.chainParam && (
                      <> · chained on <code>{`{${inference.chainParam}}`}</code></>
                    )}
                  </>
                )}
              </span>
              <button
                type="button"
                className="tx-inference-dismiss"
                onClick={() => setInference(null)}
                aria-label="Dismiss"
              >
                ✕
              </button>
            </div>
          )}
          <SyntheticForm
            mode={state.mode}
            onModeChange={(mode) => update({ mode })}
            kafka={state.kafka}
            onKafkaChange={(kafka) => update({ kafka })}
            rest={state.rest}
            onRestChange={(rest) => update({ rest })}
            headers={state.headers}
            onHeadersChange={(headers) => update({ headers })}
          />
        </div>

        {error && <div className="tx-editor-error">{error}</div>}

        <div className="tx-editor-footer">
          <span className="footer-hint">Esc to close</span>
          <button type="button" className="footer-cancel" onClick={onClose} disabled={submitting}>
            Cancel
          </button>
          <button
            type="button"
            className="footer-save"
            onClick={handleSave}
            disabled={submitting}
          >
            {submitting ? <Spinner /> : null}
            <span>{editing ? 'Save changes' : 'Create transaction'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
