import { useState } from 'react';
import { injectAndTrace } from '../../utils/synthetic';
import './SyntheticForm.css';

const defaultFormData = {
  topic: '',
  eventType: '',
  expectedFlow: '',
  timeout: 30000,
  payload: '{}',
};

export function SyntheticForm({ onResult }) {
  const [formData, setFormData] = useState(defaultFormData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
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

      onResult(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form className="synthetic-form" onSubmit={handleSubmit}>
      <h3>Inject Synthetic Transaction</h3>

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

      {error && <div className="form-error">{error}</div>}

      <button type="submit" className="submit-btn" disabled={isLoading}>
        {isLoading ? 'Injecting & Tracing...' : 'Inject & Trace'}
      </button>
    </form>
  );
}
