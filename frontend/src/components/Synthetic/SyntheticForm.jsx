import { useState } from 'react';
import { injectAndTrace, restInjectAndCheck } from '../../utils/synthetic';
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
  checkerUrl: '',
  idJsonPath: '',
  statusJsonPath: '$.status',
  expectedStatusValue: '',
  timeout: 30000,
  pollInterval: 1000,
};

export function SyntheticForm({ onResult }) {
  const [mode, setMode] = useState('rest');
  const [formData, setFormData] = useState(defaultKafkaData);
  const [restData, setRestData] = useState(defaultRestData);
  const [headers, setHeaders] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

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
      checkerUrl: restData.checkerUrl,
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
        checkerUrl: restData.checkerUrl,
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
    }
  };

  return (
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
            <label htmlFor="expectedFlow">Expected Flow</label>
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
            <label htmlFor="payload">Payload (JSON)</label>
            <textarea
              id="payload"
              value={formData.payload}
              onChange={(e) => handleChange('payload', e.target.value)}
              placeholder='{"orderId": "12345", "amount": 99.99}'
              rows={4}
            />
          </div>
        </>
      ) : (
        <>
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
              <label htmlFor="startUrl">Start Endpoint</label>
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

          <div className="form-group">
            <label htmlFor="restBody">Request Body (JSON)</label>
            <textarea
              id="restBody"
              value={restData.body}
              onChange={(e) => handleRestChange('body', e.target.value)}
              placeholder='{"orderId": "12345", "amount": 99.99}'
              rows={3}
            />
          </div>

          <div className="form-group">
            <label htmlFor="checkerUrl">Checker (Status) Endpoint</label>
            <input
              id="checkerUrl"
              type="text"
              value={restData.checkerUrl}
              onChange={(e) => handleRestChange('checkerUrl', e.target.value)}
              placeholder="https://api.example.com/orders/{{id}}/status"
              required
            />
            <span className="hint">
              Use {'{{id}}'} where the ID extracted from the start response should go
            </span>
          </div>

          <div className="form-group">
            <label htmlFor="idJsonPath">ID Extraction Path</label>
            <input
              id="idJsonPath"
              type="text"
              value={restData.idJsonPath}
              onChange={(e) => handleRestChange('idJsonPath', e.target.value)}
              placeholder="$.transactionId"
              required={restData.checkerUrl.includes('{{id}}')}
            />
            <span className="hint">JSONPath to the ID in the start response</span>
          </div>

          <div className="form-row">
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

          <div className="form-group">
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
            <span className="hint">Applied to both start and checker requests</span>
          </div>
        </>
      )}

      {error && <div className="form-error">{error}</div>}

      <button type="submit" className="submit-btn" disabled={isLoading}>
        {isLoading
          ? mode === 'kafka'
            ? 'Injecting & Tracing...'
            : 'Injecting & Checking...'
          : mode === 'kafka'
            ? 'Inject & Trace'
            : 'Inject & Check'}
      </button>
    </form>
  );
}
