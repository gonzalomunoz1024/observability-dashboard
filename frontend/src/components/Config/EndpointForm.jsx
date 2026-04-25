import { useState } from 'react';
import { useServicesDispatch } from '../../context/ServicesContext';
import './EndpointForm.css';

const generateId = () => `service_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

const defaultService = {
  name: '',
  url: '',
  method: 'GET',
  interval: 30000,
  expectedStatus: 200,
  timeout: 5000,
};

export function EndpointForm({ onClose, editService }) {
  const dispatch = useServicesDispatch();
  const [formData, setFormData] = useState(editService || defaultService);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.url.trim()) newErrors.url = 'URL is required';
    try {
      new URL(formData.url);
    } catch {
      newErrors.url = 'Invalid URL format';
    }
    if (formData.interval < 5000) newErrors.interval = 'Minimum interval is 5 seconds';
    if (formData.timeout < 1000) newErrors.timeout = 'Minimum timeout is 1 second';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validate()) return;

    if (editService) {
      dispatch({ type: 'UPDATE_SERVICE', payload: formData });
    } else {
      dispatch({
        type: 'ADD_SERVICE',
        payload: { ...formData, id: generateId() },
      });
    }
    onClose();
  };

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: null }));
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>{editService ? 'Edit Service' : 'Add Service'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="name">Service Name</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="My API Service"
            />
            {errors.name && <span className="error">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="url">URL</label>
            <input
              id="url"
              type="text"
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
              placeholder="https://api.example.com/health"
            />
            {errors.url && <span className="error">{errors.url}</span>}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="method">Method</label>
              <select
                id="method"
                value={formData.method}
                onChange={(e) => handleChange('method', e.target.value)}
              >
                <option value="GET">GET</option>
                <option value="HEAD">HEAD</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="expectedStatus">Expected Status</label>
              <input
                id="expectedStatus"
                type="number"
                value={formData.expectedStatus}
                onChange={(e) => handleChange('expectedStatus', parseInt(e.target.value, 10))}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="interval">Check Interval (ms)</label>
              <input
                id="interval"
                type="number"
                value={formData.interval}
                onChange={(e) => handleChange('interval', parseInt(e.target.value, 10))}
                min="5000"
                step="1000"
              />
              {errors.interval && <span className="error">{errors.interval}</span>}
            </div>

            <div className="form-group">
              <label htmlFor="timeout">Timeout (ms)</label>
              <input
                id="timeout"
                type="number"
                value={formData.timeout}
                onChange={(e) => handleChange('timeout', parseInt(e.target.value, 10))}
                min="1000"
                step="1000"
              />
              {errors.timeout && <span className="error">{errors.timeout}</span>}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-submit">
              {editService ? 'Update' : 'Add Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
