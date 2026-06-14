import { useEffect, useState } from 'react';
import { injectAndTrace, restInjectAndCheck } from '../../utils/synthetic';
import { IdPathPicker } from './IdPathPicker';
import './SyntheticForm.css';

const defaultKafkaData = {
  topic: '',
  eventType: '',
  expectedFlow: '',
  timeout: 30000,
  payload: '{}',
};

const defaultRestData = {
  startUrl: '',
  method: 'POST',
  body: '{}',
  probeUrl: '',
  idJsonPath: '',
  statusJsonPath: '$.status',
  expectedStatusValue: '',
  timeout: 30000,
  pollInterval: 1000,
};

function jsonValidity(text) {
  const trimmed = text.trim();
  if (!trimmed) return 'empty';
  try {
    JSON.parse(trimmed);
    return 'valid';
  } catch {
    return 'invalid';
  }
}

function PlayIcon() {
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M4.5 2.7a.5.5 0 0 1 .76-.43l8.4 5.3a.5.5 0 0 1 0 .85l-8.4 5.3a.5.5 0 0 1-.76-.42V2.7z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.3" strokeWidth="2" />
      <path d="M14.5 8A6.5 6.5 0 0 0 8 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
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

function JsonFieldHeader({ htmlFor, label, validity, onBeautify, onExpand }) {
  return (
    <div className="label-row">
      <label htmlFor={htmlFor}>{label}</label>
      <span className="label-row-actions">
        {validity === 'invalid' && <span className="json-chip json-chip-invalid">Invalid JSON</span>}
        {validity === 'valid' && <span className="json-chip json-chip-valid">JSON</span>}
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
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [field, onClose]);

  if (!field) return null;

  const validity = field.isJson ? jsonValidity(field.value) : null;

  const handleBeautify = () => {
    try {
      onChange(JSON.stringify(JSON.parse(field.value), null, 2));
    } catch {
      /* keep current value if invalid */
    }
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
                {validity === 'invalid' && (
                  <span className="json-chip json-chip-invalid">Invalid JSON</span>
                )}
                {validity === 'valid' && (
                  <span className="json-chip json-chip-valid">JSON</span>
                )}
                <button
                  type="button"
                  className="beautify-btn"
                  onClick={handleBeautify}
                  disabled={validity !== 'valid'}
                  title="Format JSON"
                >
                  Beautify
                </button>
              </>
            )}
            <button
              type="button"
              className="field-drawer-close"
              onClick={onClose}
              aria-label="Close"
            >
              <CloseIcon />
            </button>
          </div>
        </div>
        <div className="field-drawer-body">
          {field.multiline ? (
            <textarea
              className={`field-drawer-textarea ${
                field.isJson && validity === 'invalid' ? 'json-invalid' : ''
              }`}
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
          <button type="button" className="field-drawer-done" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

export function SyntheticForm({ onResult, onRunStateChange }) {
  const [mode, setMode] = useState('rest');
  const [formData, setFormData] = useState(defaultKafkaData);
  const [restData, setRestData] = useState(defaultRestData);
  const [headers, setHeaders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [expandedField, setExpandedField] = useState(null);
  const [idPickerOpen, setIdPickerOpen] = useState(false);

  const bodyValidity = jsonValidity(restData.body);
  const payloadValidity = jsonValidity(formData.payload);
  const submitBlocked =
    isLoading || (mode === 'rest' ? bodyValidity === 'invalid' : payloadValidity === 'invalid');

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleRestChange = (field, value) => {
    setRestData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleHeaderChange = (index, field, value) => {
    setHeaders((prev) => prev.map((h, i) => (i === index ? { ...h, [field]: value } : h)));
    setError(null);
  };

  const addHeader = () => setHeaders((prev) => [...prev, { key: '', value: '' }]);
  const removeHeader = (index) => setHeaders((prev) => prev.filter((_, i) => i !== index));

  const beautify = (field, setter) => () => {
    setter((prev) => {
      try {
        return { ...prev, [field]: JSON.stringify(JSON.parse(prev[field]), null, 2) };
      } catch {
        return prev;
      }
    });
  };

  const expandRest = (key, label, opts = {}) => () =>
    setExpandedField({
      key: `rest.${key}`,
      label,
      eyebrow: opts.eyebrow,
      multiline: opts.multiline ?? false,
      isJson: opts.isJson ?? false,
      type: opts.type,
      placeholder: opts.placeholder,
      hint: opts.hint,
    });

  const expandKafka = (key, label, opts = {}) => () =>
    setExpandedField({
      key: `kafka.${key}`,
      label,
      eyebrow: opts.eyebrow,
      multiline: opts.multiline ?? false,
      isJson: opts.isJson ?? false,
      type: opts.type,
      placeholder: opts.placeholder,
      hint: opts.hint,
    });

  const expandedValue = (() => {
    if (!expandedField) return '';
    const [scope, key] = expandedField.key.split('.');
    return scope === 'rest' ? restData[key] : formData[key];
  })();

  const handleExpandedChange = (value) => {
    if (!expandedField) return;
    const [scope, key] = expandedField.key.split('.');
    if (scope === 'rest') handleRestChange(key, value);
    else handleChange(key, value);
  };

  const handleKafkaSubmit = async () => {
    let payload = {};
    if (formData.payload.trim()) {
      payload = JSON.parse(formData.payload);
    }

    const result = await injectAndTrace(
      formData.topic,
      formData.eventType,
      formData.expectedFlow,
      {
        payload,
        timeout: formData.timeout,
      }
    );

    onResult({ mode: 'kafka', ...result });
  };

  const handleRestSubmit = async () => {
    if (restData.body.trim()) {
      JSON.parse(restData.body);
    }

    const headerMap = headers.reduce((acc, h) => {
      if (h.key.trim()) acc[h.key.trim()] = h.value;
      return acc;
    }, {});

    const check = await restInjectAndCheck({
      startUrl: restData.startUrl,
      method: restData.method,
      body: restData.body,
      headers: headerMap,
      probeUrl: restData.probeUrl,
      idJsonPath: restData.idJsonPath,
      statusJsonPath: restData.statusJsonPath,
      expectedStatusValue: restData.expectedStatusValue,
      timeout: restData.timeout,
      pollInterval: restData.pollInterval,
    });

    onResult({
      mode: 'rest',
      request: {
        startUrl: restData.startUrl,
        method: restData.method,
        probeUrl: restData.probeUrl,
        expectedStatusValue: restData.expectedStatusValue,
        statusJsonPath: restData.statusJsonPath,
      },
      check,
      timestamp: Date.now(),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    onRunStateChange?.(true, mode);

    try {
      if (mode === 'kafka') {
        await handleKafkaSubmit();
      } else {
        await handleRestSubmit();
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
      onRunStateChange?.(false, mode);
    }
  };

  const pollingSummary = `${restData.timeout / 1000}s timeout · poll ${restData.pollInterval}ms${
    headers.length > 0 ? ` · ${headers.length} header${headers.length > 1 ? 's' : ''}` : ''
  }`;

  const drawerField = expandedField
    ? { ...expandedField, value: expandedValue }
    : null;

  return (
    <>
      <form className="synthetic-form" onSubmit={handleSubmit}>
        <h3>Inject Synthetic Transaction</h3>

      <div className="mode-selector" role="radiogroup" aria-label="Injection mode">
        <button
          type="button"
          className={`mode-option ${mode === 'rest' ? 'mode-active' : ''}`}
          onClick={() => { setMode('rest'); setError(null); }}
        >
          REST Controller
        </button>
        <button
          type="button"
          className={`mode-option ${mode === 'kafka' ? 'mode-active' : ''}`}
          onClick={() => { setMode('kafka'); setError(null); }}
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
                value={formData.topic}
                onChange={(e) => handleChange('topic', e.target.value)}
                placeholder="my-events-topic"
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="eventType">Event Type</label>
              <input
                id="eventType"
                type="text"
                value={formData.eventType}
                onChange={(e) => handleChange('eventType', e.target.value)}
                placeholder="OrderCreated"
                required
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
              value={formData.expectedFlow}
              onChange={(e) => handleChange('expectedFlow', e.target.value)}
              placeholder="OrderCreated -> OrderValidated -> OrderProcessed -> OrderCompleted"
              required
            />
            <span className="hint">Use arrows to define the expected event sequence</span>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="timeout">Timeout (ms)</label>
              <input
                id="timeout"
                type="number"
                value={formData.timeout}
                onChange={(e) => handleChange('timeout', parseInt(e.target.value, 10))}
                min="5000"
                step="5000"
              />
            </div>
          </div>

          <div className="form-group">
            <JsonFieldHeader
              htmlFor="payload"
              label="Payload (JSON)"
              validity={payloadValidity}
              onBeautify={beautify('payload', setFormData)}
              onExpand={expandKafka('payload', 'Payload (JSON)', {
                eyebrow: 'Kafka',
                multiline: true,
                isJson: true,
                placeholder: '{"orderId": "12345", "amount": 99.99}',
              })}
            />
            <textarea
              id="payload"
              className={payloadValidity === 'invalid' ? 'json-invalid' : ''}
              value={formData.payload}
              onChange={(e) => handleChange('payload', e.target.value)}
              placeholder='{"orderId": "12345", "amount": 99.99}'
              rows={4}
              spellCheck={false}
            />
          </div>
        </>
      ) : (
        <>
          <div className="form-section">
            <div className="form-section-header form-section-static">
              <span className="form-section-title">Start Request</span>
              <span className="form-section-summary">{restData.method}</span>
            </div>
            <div className="form-section-body">
              <div className="form-row form-row-url">
                <div className="form-group form-group-method">
                  <label htmlFor="restMethod">Method</label>
                  <select
                    id="restMethod"
                    value={restData.method}
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
                    value={restData.startUrl}
                    onChange={(e) => handleRestChange('startUrl', e.target.value)}
                    placeholder="https://api.example.com/orders"
                    required
                  />
                </div>
              </div>

              <div className="form-group form-group-last">
                <JsonFieldHeader
                  htmlFor="restBody"
                  label="Request Body (JSON)"
                  validity={bodyValidity}
                  onBeautify={beautify('body', setRestData)}
                  onExpand={expandRest('body', 'Request Body (JSON)', {
                    eyebrow: 'Start Request',
                    multiline: true,
                    isJson: true,
                    placeholder: '{"orderId": "12345", "amount": 99.99}',
                  })}
                />
                <textarea
                  id="restBody"
                  className={bodyValidity === 'invalid' ? 'json-invalid' : ''}
                  value={restData.body}
                  onChange={(e) => handleRestChange('body', e.target.value)}
                  placeholder='{"orderId": "12345", "amount": 99.99}'
                  rows={3}
                  spellCheck={false}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <div className="form-section-header form-section-static">
              <span className="form-section-title">Status Probe</span>
              {restData.expectedStatusValue && (
                <span className="form-section-summary">
                  {restData.statusJsonPath} = {restData.expectedStatusValue}
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
                  value={restData.probeUrl}
                  onChange={(e) => handleRestChange('probeUrl', e.target.value)}
                  placeholder="https://api.example.com/orders/{{id}}/status"
                  required
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
                  value={restData.idJsonPath}
                  onChange={(e) => handleRestChange('idJsonPath', e.target.value)}
                  placeholder="$.transactionId"
                  required={restData.probeUrl.includes('{{id}}')}
                />
                <span className="hint">JSONPath to the ID in the start response</span>
              </div>

              <div className="form-row form-group-last">
                <div className="form-group">
                  <label htmlFor="statusJsonPath">Status Field Path</label>
                  <input
                    id="statusJsonPath"
                    type="text"
                    value={restData.statusJsonPath}
                    onChange={(e) => handleRestChange('statusJsonPath', e.target.value)}
                    placeholder="$.status"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="expectedStatusValue">Terminal Value</label>
                  <input
                    id="expectedStatusValue"
                    type="text"
                    value={restData.expectedStatusValue}
                    onChange={(e) => handleRestChange('expectedStatusValue', e.target.value)}
                    placeholder="COMPLETED"
                    required
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
                    <label htmlFor="restTimeout">Timeout (ms)</label>
                    <input
                      id="restTimeout"
                      type="number"
                      value={restData.timeout}
                      onChange={(e) => handleRestChange('timeout', parseInt(e.target.value, 10))}
                      min="1000"
                      step="1000"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="pollInterval">Poll Interval (ms)</label>
                    <input
                      id="pollInterval"
                      type="number"
                      value={restData.pollInterval}
                      onChange={(e) => handleRestChange('pollInterval', parseInt(e.target.value, 10))}
                      min="250"
                      step="250"
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

      {error && <div className="form-error">{error}</div>}

      <button type="submit" className="submit-btn" disabled={submitBlocked}>
        {isLoading ? <Spinner /> : <PlayIcon />}
        <span>
          {isLoading
            ? mode === 'kafka'
              ? 'Injecting & Tracing…'
              : 'Injecting & Checking…'
            : mode === 'kafka'
              ? 'Inject & Trace'
              : 'Inject & Check'}
        </span>
      </button>
    </form>

      <FieldExpandDrawer
        field={drawerField}
        onChange={handleExpandedChange}
        onClose={() => setExpandedField(null)}
      />

      <IdPathPicker
        open={idPickerOpen}
        request={{
          url: restData.startUrl,
          method: restData.method,
          body: restData.body,
        }}
        headers={headers.reduce((acc, h) => {
          if (h.key.trim()) acc[h.key.trim()] = h.value;
          return acc;
        }, {})}
        value={restData.idJsonPath}
        onChange={(path) => handleRestChange('idJsonPath', path)}
        onClose={() => setIdPickerOpen(false)}
      />
    </>
  );
}
