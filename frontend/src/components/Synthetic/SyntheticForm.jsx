import { useEffect, useState } from 'react';
import { IdPathPicker } from './IdPathPicker';
import { JsonEditor } from './JsonEditor';
import { RequestShapePanel } from './RequestShapePanel';
import { previewTemplate } from '../../utils/synthetic';
import './SyntheticForm.css';

export const DEFAULT_KAFKA_CONFIG = {
  topic: '',
  eventType: '',
  expectedFlow: '',
  timeout: 30000,
  payload: '{}',
  dynamicFields: [],
};

export const DEFAULT_REST_CONFIG = {
  startUrl: '',
  method: 'POST',
  body: '{}',
  probeUrl: '',
  idJsonPath: '',
  statusJsonPath: '$.status',
  expectedStatusValue: '',
  timeout: 30000,
  pollInterval: 1000,
  requestFields: [],
  dynamicFields: [],
};

const DURATION_UNITS = [
  { label: 'ms',  ms: 1 },
  { label: 's',   ms: 1000 },
  { label: 'min', ms: 60_000 },
  { label: 'hr',  ms: 3_600_000 },
];

function pickUnit(ms) {
  if (ms == null || ms === 0) return DURATION_UNITS[1]; // default seconds
  if (ms % 3_600_000 === 0) return DURATION_UNITS[3];
  if (ms % 60_000 === 0) return DURATION_UNITS[2];
  if (ms % 1000 === 0) return DURATION_UNITS[1];
  return DURATION_UNITS[0];
}

function DurationInput({ id, valueMs, onChange, units = DURATION_UNITS, minMs = 0 }) {
  const unit = pickUnit(valueMs);
  const display = unit.ms === 0 ? 0 : (valueMs ?? 0) / unit.ms;

  const handleValue = (next) => {
    const num = Number(next);
    if (Number.isNaN(num)) return;
    const ms = Math.max(minMs, Math.round(num * unit.ms));
    onChange(ms);
  };

  const handleUnit = (label) => {
    const next = units.find((u) => u.label === label);
    if (!next) return;
    // Re-normalize the displayed amount under the new unit, then convert back.
    onChange(Math.max(minMs, Math.round(display * next.ms)));
  };

  return (
    <div className="duration-input">
      <input
        id={id}
        type="number"
        value={display}
        onChange={(e) => handleValue(e.target.value)}
        min={0}
        step={unit.label === 'ms' ? 100 : 1}
      />
      <select value={unit.label} onChange={(e) => handleUnit(e.target.value)}>
        {units.map((u) => <option key={u.label} value={u.label}>{u.label}</option>)}
      </select>
    </div>
  );
}

export function jsonValidity(text) {
  const trimmed = (text || '').trim();
  if (!trimmed) return 'empty';
  try {
    JSON.parse(trimmed);
    return 'valid';
  } catch {
    return 'invalid';
  }
}

function Chevron({ open }) {
  return (
    <svg
      className={`section-chevron ${open ? 'section-chevron-open' : ''}`}
      width="12"
      height="12"
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden="true"
    >
      <path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ExpandIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M9.5 2.5h4v4M13.5 2.5L8.5 7.5M6.5 13.5h-4v-4M2.5 13.5l5-5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function WandIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M11 2l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2zM3.5 12.5l6-6 2 2-6 6-2-2z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M1.5 8s2.5-4.5 6.5-4.5S14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  );
}

function ExpandButton({ onClick, label }) {
  return (
    <button
      type="button"
      className="field-expand-btn"
      onClick={onClick}
      aria-label={`Expand ${label}`}
      title={`Expand ${label}`}
    >
      <ExpandIcon />
    </button>
  );
}

function FieldLabel({ htmlFor, label, onExpand }) {
  return (
    <div className="label-row">
      <label htmlFor={htmlFor}>{label}</label>
      <span className="label-row-actions">
        <ExpandButton onClick={onExpand} label={label} />
      </span>
    </div>
  );
}

function JsonFieldHeader({ label, validity, onBeautify, onExpand, onPreview }) {
  return (
    <div className="label-row">
      <span className="label-text">{label}</span>
      <span className="label-row-actions">
        {validity === 'invalid' && <span className="json-chip json-chip-invalid">Invalid JSON</span>}
        {validity === 'valid' && <span className="json-chip json-chip-valid">JSON</span>}
        {onPreview && (
          <button type="button" className="preview-btn" onClick={onPreview} title="Preview the body with dynamic values filled in">
            <EyeIcon />
            <span>Preview</span>
          </button>
        )}
        <button
          type="button"
          className="beautify-btn"
          onClick={onBeautify}
          disabled={validity !== 'valid'}
          title="Format JSON"
        >
          Beautify
        </button>
        {onExpand && <ExpandButton onClick={onExpand} label={label} />}
      </span>
    </div>
  );
}

function FieldExpandDrawer({ field, onChange, onClose }) {
  useEffect(() => {
    if (!field) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [field, onClose]);

  if (!field) return null;

  const validity = field.isJson ? jsonValidity(field.value) : null;

  const handleBeautify = () => {
    try {
      onChange(JSON.stringify(JSON.parse(field.value), null, 2));
    } catch { /* keep current */ }
  };

  return (
    <div className="field-drawer-overlay" onClick={onClose}>
      <div className="field-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="field-drawer-header">
          <div className="field-drawer-title-group">
            {field.eyebrow && <span className="field-drawer-eyebrow">{field.eyebrow}</span>}
            <h2 className="field-drawer-title">{field.label}</h2>
          </div>
          <div className="field-drawer-actions">
            {field.isJson && (
              <>
                {validity === 'invalid' && <span className="json-chip json-chip-invalid">Invalid JSON</span>}
                {validity === 'valid' && <span className="json-chip json-chip-valid">JSON</span>}
                <button type="button" className="beautify-btn" onClick={handleBeautify} disabled={validity !== 'valid'}>
                  Beautify
                </button>
              </>
            )}
            <button type="button" className="field-drawer-close" onClick={onClose} aria-label="Close">
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="field-drawer-body">
          {field.isJson ? (
            <JsonEditor
              value={field.value}
              onChange={(v) => onChange(v)}
              invalid={validity === 'invalid'}
              height="100%"
            />
          ) : field.multiline ? (
            <textarea
              className="field-drawer-textarea"
              value={field.value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              spellCheck={false}
              autoFocus
            />
          ) : (
            <input
              className="field-drawer-input"
              type={field.type || 'text'}
              value={field.value}
              onChange={(e) => onChange(e.target.value)}
              placeholder={field.placeholder}
              spellCheck={false}
              autoFocus
            />
          )}
          {field.hint && <p className="field-drawer-hint">{field.hint}</p>}
        </div>
        <div className="field-drawer-footer">
          <span className="field-drawer-hotkey">Esc to close</span>
          <button type="button" className="field-drawer-done" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

function PreviewModal({ open, label, value, dynamicFields, onClose }) {
  const [rendered, setRendered] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setRendered('');
    previewTemplate(value || '', dynamicFields || [])
      .then((r) => { if (!cancelled) setRendered(r.rendered ?? ''); })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, value, dynamicFields]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="preview-overlay" onClick={onClose}>
      <div className="preview-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="preview-header">
          <div className="preview-title-group">
            <span className="preview-eyebrow">Sample render</span>
            <h3 className="preview-title">{label}</h3>
          </div>
          <button type="button" className="preview-close" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="preview-body">
          {loading ? (
            <p className="preview-placeholder">Rendering…</p>
          ) : error ? (
            <p className="preview-error">{error}</p>
          ) : (
            <JsonEditor value={rendered} readOnly height={420} />
          )}
        </div>
        <div className="preview-footer">
          <span className="preview-hint">One sample render. Values change each run.</span>
          <button type="button" className="preview-done" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

export function SyntheticForm({ mode, onModeChange, kafka, onKafkaChange, rest, onRestChange, headers, onHeadersChange }) {
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expandedField, setExpandedField] = useState(null);
  const [idPickerOpen, setIdPickerOpen] = useState(false);
  const [previewTarget, setPreviewTarget] = useState(null);

  const bodyValidity = jsonValidity(rest.body);
  const payloadValidity = jsonValidity(kafka.payload);

  const handleRestChange = (field, value) => onRestChange({ ...rest, [field]: value });
  const handleKafkaChange = (field, value) => onKafkaChange({ ...kafka, [field]: value });

  const handleHeaderChange = (index, field, value) => {
    onHeadersChange(headers.map((h, i) => (i === index ? { ...h, [field]: value } : h)));
  };
  const addHeader = () => onHeadersChange([...headers, { key: '', value: '' }]);
  const removeHeader = (index) => onHeadersChange(headers.filter((_, i) => i !== index));

  const beautifyJson = (field, source, setter) => () => {
    try {
      setter(field, JSON.stringify(JSON.parse(source), null, 2));
    } catch { /* no-op */ }
  };

  const expandRest = (key, label, opts = {}) => () =>
    setExpandedField({ key: `rest.${key}`, label, ...opts });

  const expandKafka = (key, label, opts = {}) => () =>
    setExpandedField({ key: `kafka.${key}`, label, ...opts });

  const expandedValue = (() => {
    if (!expandedField) return '';
    const [scope, key] = expandedField.key.split('.');
    return scope === 'rest' ? rest[key] : kafka[key];
  })();

  const handleExpandedChange = (value) => {
    if (!expandedField) return;
    const [scope, key] = expandedField.key.split('.');
    if (scope === 'rest') handleRestChange(key, value);
    else handleKafkaChange(key, value);
  };

  const drawerField = expandedField ? { ...expandedField, value: expandedValue } : null;

  const headerMap = headers.reduce((acc, h) => {
    if (h.key.trim()) acc[h.key.trim()] = h.value;
    return acc;
  }, {});

  const formatDuration = (ms) => {
    if (!ms) return '0s';
    if (ms % 3_600_000 === 0) return `${ms / 3_600_000}hr`;
    if (ms % 60_000 === 0) return `${ms / 60_000}min`;
    if (ms % 1000 === 0) return `${ms / 1000}s`;
    return `${ms}ms`;
  };

  const pollingSummary = `${formatDuration(rest.timeout)} timeout · poll ${formatDuration(rest.pollInterval)}${
    headers.length > 0 ? ` · ${headers.length} header${headers.length > 1 ? 's' : ''}` : ''
  }`;

  return (
    <>
      <div className="synthetic-form synthetic-form-embedded">
        <div className="mode-selector" role="radiogroup" aria-label="Injection mode">
          <button
            type="button"
            className={`mode-option ${mode === 'rest' ? 'mode-active' : ''}`}
            onClick={() => onModeChange('rest')}
          >
            REST Controller
          </button>
          <button
            type="button"
            className={`mode-option ${mode === 'kafka' ? 'mode-active' : ''}`}
            onClick={() => onModeChange('kafka')}
          >
            Kafka
          </button>
        </div>

        {mode === 'kafka' ? (
          <>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="topic">Kafka Topic</label>
                <input
                  id="topic"
                  type="text"
                  value={kafka.topic}
                  onChange={(e) => handleKafkaChange('topic', e.target.value)}
                  placeholder="my-events-topic"
                />
              </div>
              <div className="form-group">
                <label htmlFor="eventType">Event Type</label>
                <input
                  id="eventType"
                  type="text"
                  value={kafka.eventType}
                  onChange={(e) => handleKafkaChange('eventType', e.target.value)}
                  placeholder="OrderCreated"
                />
              </div>
            </div>

            <div className="form-group">
              <FieldLabel
                htmlFor="expectedFlow"
                label="Expected Flow"
                onExpand={expandKafka('expectedFlow', 'Expected Flow', {
                  eyebrow: 'Kafka',
                  multiline: true,
                  placeholder: 'OrderCreated -> OrderValidated -> OrderProcessed -> OrderCompleted',
                  hint: 'Use arrows to define the expected event sequence',
                })}
              />
              <input
                id="expectedFlow"
                type="text"
                value={kafka.expectedFlow}
                onChange={(e) => handleKafkaChange('expectedFlow', e.target.value)}
                placeholder="OrderCreated -> OrderValidated -> OrderProcessed -> OrderCompleted"
              />
              <span className="hint">Use arrows to define the expected event sequence</span>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="timeout">Timeout</label>
                <DurationInput
                  id="timeout"
                  valueMs={kafka.timeout}
                  onChange={(ms) => handleKafkaChange('timeout', ms)}
                  minMs={1000}
                />
              </div>
            </div>

            <div className="form-group">
              <JsonFieldHeader
                label="Payload"
                validity={payloadValidity}
                onBeautify={beautifyJson('payload', kafka.payload, (k, v) => handleKafkaChange(k, v))}
                onExpand={expandKafka('payload', 'Payload (JSON)', {
                  eyebrow: 'Kafka',
                  isJson: true,
                })}
                onPreview={() => setPreviewTarget({
                  label: 'Payload (resolved)',
                  value: kafka.payload,
                  dynamicFields: [],
                })}
              />
              <JsonEditor
                value={kafka.payload}
                onChange={(v) => handleKafkaChange('payload', v)}
                invalid={payloadValidity === 'invalid'}
                height={200}
              />
            </div>
          </>
        ) : (
          <>
            <div className="form-section">
              <div className="form-section-header form-section-static">
                <span className="form-section-title">Start Request</span>
                <span className="form-section-summary">{rest.method}</span>
              </div>
              <div className="form-section-body">
                <div className="form-row form-row-url">
                  <div className="form-group form-group-method">
                    <label htmlFor="restMethod">Method</label>
                    <select
                      id="restMethod"
                      value={rest.method}
                      onChange={(e) => handleRestChange('method', e.target.value)}
                    >
                      <option>POST</option>
                      <option>PUT</option>
                      <option>PATCH</option>
                      <option>GET</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <FieldLabel
                      htmlFor="startUrl"
                      label="Start Endpoint"
                      onExpand={expandRest('startUrl', 'Start Endpoint', {
                        eyebrow: 'Start Request',
                        type: 'url',
                        placeholder: 'https://api.example.com/orders',
                      })}
                    />
                    <input
                      id="startUrl"
                      type="url"
                      value={rest.startUrl}
                      onChange={(e) => handleRestChange('startUrl', e.target.value)}
                      placeholder="https://api.example.com/orders"
                    />
                  </div>
                </div>

                <div className="form-group form-group-last">
                  <JsonFieldHeader
                    label="Request Body"
                    validity={bodyValidity}
                    onBeautify={beautifyJson('body', rest.body, (k, v) => handleRestChange(k, v))}
                    onExpand={expandRest('body', 'Request Body (JSON)', {
                      eyebrow: 'Start Request',
                      isJson: true,
                    })}
                    onPreview={() => setPreviewTarget({
                      label: 'Request Body (resolved)',
                      value: rest.body,
                      dynamicFields: rest.dynamicFields || [],
                    })}
                  />
                  <JsonEditor
                    value={rest.body}
                    onChange={(v) => handleRestChange('body', v)}
                    invalid={bodyValidity === 'invalid'}
                    height={200}
                  />
                  <RequestShapePanel
                    fields={rest.requestFields || []}
                    dynamicFields={rest.dynamicFields || []}
                    onChange={(next) => handleRestChange('dynamicFields', next)}
                  />
                </div>
              </div>
            </div>

            <div className="form-section">
              <div className="form-section-header form-section-static">
                <span className="form-section-title">Status Probe</span>
                {rest.expectedStatusValue && (
                  <span className="form-section-summary">
                    {rest.statusJsonPath} = {rest.expectedStatusValue}
                  </span>
                )}
              </div>
              <div className="form-section-body">
                <div className="form-group">
                  <FieldLabel
                    htmlFor="probeUrl"
                    label="Probe Endpoint"
                    onExpand={expandRest('probeUrl', 'Probe Endpoint', {
                      eyebrow: 'Status Probe',
                      placeholder: 'https://api.example.com/orders/{{id}}/status',
                      hint: 'Use {{id}} where the ID extracted from the start response should go',
                    })}
                  />
                  <input
                    id="probeUrl"
                    type="text"
                    value={rest.probeUrl}
                    onChange={(e) => handleRestChange('probeUrl', e.target.value)}
                    placeholder="https://api.example.com/orders/{{id}}/status"
                  />
                  <span className="hint">
                    Use {'{{id}}'} where the ID extracted from the start response should go
                  </span>
                </div>

                <div className="form-group">
                  <div className="label-row">
                    <label htmlFor="idJsonPath">ID Extraction Path</label>
                    <span className="label-row-actions">
                      <button
                        type="button"
                        className="pick-id-btn"
                        onClick={() => setIdPickerOpen(true)}
                        title="Send start request and pick an ID from the response"
                      >
                        <WandIcon />
                        <span>Pick from response</span>
                      </button>
                    </span>
                  </div>
                  <input
                    id="idJsonPath"
                    type="text"
                    value={rest.idJsonPath}
                    onChange={(e) => handleRestChange('idJsonPath', e.target.value)}
                    placeholder="$.transactionId"
                  />
                  <span className="hint">JSONPath to the ID in the start response</span>
                </div>

                <div className="form-row form-group-last">
                  <div className="form-group">
                    <label htmlFor="statusJsonPath">Status Field Path</label>
                    <input
                      id="statusJsonPath"
                      type="text"
                      value={rest.statusJsonPath}
                      onChange={(e) => handleRestChange('statusJsonPath', e.target.value)}
                      placeholder="$.status"
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="expectedStatusValue">Terminal Value</label>
                    <input
                      id="expectedStatusValue"
                      type="text"
                      value={rest.expectedStatusValue}
                      onChange={(e) => handleRestChange('expectedStatusValue', e.target.value)}
                      placeholder="COMPLETED"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="form-section">
              <button
                type="button"
                className="form-section-header"
                onClick={() => setAdvancedOpen((open) => !open)}
                aria-expanded={advancedOpen}
              >
                <Chevron open={advancedOpen} />
                <span className="form-section-title">Polling &amp; Headers</span>
                <span className="form-section-summary">{pollingSummary}</span>
              </button>
              {advancedOpen && (
                <div className="form-section-body animate-fade-in">
                  <div className="form-row">
                    <div className="form-group">
                      <label htmlFor="restTimeout">Timeout</label>
                      <DurationInput
                        id="restTimeout"
                        valueMs={rest.timeout}
                        onChange={(ms) => handleRestChange('timeout', ms)}
                        minMs={1000}
                      />
                    </div>
                    <div className="form-group">
                      <label htmlFor="pollInterval">Poll Interval</label>
                      <DurationInput
                        id="pollInterval"
                        valueMs={rest.pollInterval}
                        onChange={(ms) => handleRestChange('pollInterval', ms)}
                        minMs={250}
                      />
                    </div>
                  </div>

                  <div className="form-group form-group-last">
                    <div className="headers-label-row">
                      <label>Headers (optional)</label>
                      <button type="button" className="header-add-btn" onClick={addHeader}>
                        + Add
                      </button>
                    </div>
                    {headers.map((header, index) => (
                      <div key={index} className="header-row">
                        <input
                          type="text"
                          value={header.key}
                          onChange={(e) => handleHeaderChange(index, 'key', e.target.value)}
                          placeholder="Authorization"
                          aria-label={`Header ${index + 1} name`}
                        />
                        <input
                          type="text"
                          value={header.value}
                          onChange={(e) => handleHeaderChange(index, 'value', e.target.value)}
                          placeholder="Bearer token..."
                          aria-label={`Header ${index + 1} value`}
                        />
                        <button
                          type="button"
                          className="header-remove-btn"
                          onClick={() => removeHeader(index)}
                          aria-label={`Remove header ${index + 1}`}
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                    <span className="hint">Applied to both start and probe requests</span>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <FieldExpandDrawer
        field={drawerField}
        onChange={handleExpandedChange}
        onClose={() => setExpandedField(null)}
      />

      <IdPathPicker
        open={idPickerOpen}
        request={{
          url: rest.startUrl,
          method: rest.method,
          body: rest.body,
          dynamicFields: rest.dynamicFields || [],
        }}
        headers={headerMap}
        value={rest.idJsonPath}
        onChange={(path) => handleRestChange('idJsonPath', path)}
        onClose={() => setIdPickerOpen(false)}
      />

      <PreviewModal
        open={previewTarget != null}
        label={previewTarget?.label}
        value={previewTarget?.value}
        dynamicFields={previewTarget?.dynamicFields}
        onClose={() => setPreviewTarget(null)}
      />
    </>
  );
}
