import { useState } from 'react';
import { useServices } from '../../context/ServicesContext';
import { sendTestEmail } from '../../utils/monitoredServices';
import './MonitoredServiceForm.css';

const defaultService = {
  name: '',
  url: '',
  method: 'GET',
  timeout: 5000,
  expectedStatus: 200,
  checkIntervalSeconds: 60,
  alertRecipients: '',
};

export function MonitoredServiceForm({ onClose, onSubmit, editService, isLoading }) {
  const { services: healthServices } = useServices();
  const [formData, setFormData] = useState(
    editService
      ? {
          ...editService,
          alertRecipients: editService.alertRecipients?.join(', ') || '',
        }
      : defaultService
  );
  const [errors, setErrors] = useState({});
  const [testEmailStatus, setTestEmailStatus] = useState(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  const handleTestEmail = async () => {
    const emails = formData.alertRecipients.split(',').map(e => e.trim()).filter(e => e);
    if (emails.length === 0 || emails.some(e => !isValidEmail(e))) {
      setTestEmailStatus({ success: false, message: 'Please enter valid email addresses first' });
      return;
    }

    setIsSendingTest(true);
    setTestEmailStatus(null);

    try {
      const result = await sendTestEmail(emails, formData.name || 'Test Service');
      setTestEmailStatus({ success: true, message: result.message });
    } catch (error) {
      setTestEmailStatus({ success: false, message: error.message });
    } finally {
      setIsSendingTest(false);
    }
  };

  const handleImportService = (serviceId) => {
    if (!serviceId) return;
    const service = healthServices.find((s) => s.id === serviceId);
    if (service) {
      setFormData((prev) => ({
        ...prev,
        name: service.name,
        url: service.url,
        method: service.method || 'GET',
        timeout: service.timeout || 5000,
        expectedStatus: service.expectedStatus || 200,
        checkIntervalSeconds: Math.round((service.interval || 60000) / 1000),
      }));
      setErrors({});
    }
  };

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.url.trim()) {
      newErrors.url = 'URL is required';
    } else {
      try {
        new URL(formData.url);
      } catch {
        newErrors.url = 'Invalid URL format';
      }
    }

    if (!formData.alertRecipients.trim()) {
      newErrors.alertRecipients = 'At least one email recipient is required';
    } else {
      const emails = formData.alertRecipients.split(',').map((e) => e.trim());
      const invalidEmails = emails.filter((e) => !isValidEmail(e));
      if (invalidEmails.length > 0) {
        newErrors.alertRecipients = `Invalid email(s): ${invalidEmails.join(', ')}`;
      }
    }

    if (formData.timeout < 1000) {
      newErrors.timeout = 'Minimum timeout is 1 second';
    }

    if (formData.checkIntervalSeconds < 10) {
      newErrors.checkIntervalSeconds = 'Minimum interval is 10 seconds';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    const serviceData = {
      ...formData,
      alertRecipients: formData.alertRecipients
        .split(',')
        .map((e) => e.trim())
        .filter((e) => e),
    };

    await onSubmit(serviceData);
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
        <h2>{editService ? 'Edit Monitored Service' : 'Add Monitored Service'}</h2>
        <p className="form-description">
          Services are checked automatically. Email alerts are sent after 3 consecutive failures.
        </p>

        <form onSubmit={handleSubmit}>
          {!editService && healthServices.length > 0 && (
            <div className="form-group import-section">
              <label htmlFor="importService">Import from Health Monitoring</label>
              <select
                id="importService"
                onChange={(e) => handleImportService(e.target.value)}
                disabled={isLoading}
                defaultValue=""
              >
                <option value="">-- Select a service to import --</option>
                {healthServices.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                  </option>
                ))}
              </select>
              <span className="import-hint">Or fill in the details manually below</span>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="name">Service Name</label>
            <input
              id="name"
              type="text"
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="My API Service"
              disabled={isLoading}
            />
            {errors.name && <span className="error">{errors.name}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="url">Health Check URL</label>
            <input
              id="url"
              type="text"
              value={formData.url}
              onChange={(e) => handleChange('url', e.target.value)}
              placeholder="https://api.example.com/health"
              disabled={isLoading}
            />
            {errors.url && <span className="error">{errors.url}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="alertRecipients">Alert Recipients (comma-separated emails)</label>
            <div className="input-with-button">
              <input
                id="alertRecipients"
                type="text"
                value={formData.alertRecipients}
                onChange={(e) => handleChange('alertRecipients', e.target.value)}
                placeholder="ops@example.com, dev@example.com"
                disabled={isLoading}
              />
              <button
                type="button"
                className="btn-test-email"
                onClick={handleTestEmail}
                disabled={isLoading || isSendingTest || !formData.alertRecipients.trim()}
              >
                {isSendingTest ? 'Sending...' : 'Test'}
              </button>
            </div>
            {errors.alertRecipients && (
              <span className="error">{errors.alertRecipients}</span>
            )}
            {testEmailStatus && (
              <span className={`test-status ${testEmailStatus.success ? 'success' : 'error'}`}>
                {testEmailStatus.message}
              </span>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="method">Method</label>
              <select
                id="method"
                value={formData.method}
                onChange={(e) => handleChange('method', e.target.value)}
                disabled={isLoading}
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
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label htmlFor="checkIntervalSeconds">Check Interval (seconds)</label>
              <input
                id="checkIntervalSeconds"
                type="number"
                value={formData.checkIntervalSeconds}
                onChange={(e) =>
                  handleChange('checkIntervalSeconds', parseInt(e.target.value, 10))
                }
                min="10"
                disabled={isLoading}
              />
              {errors.checkIntervalSeconds && (
                <span className="error">{errors.checkIntervalSeconds}</span>
              )}
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
                disabled={isLoading}
              />
              {errors.timeout && <span className="error">{errors.timeout}</span>}
            </div>
          </div>

          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={isLoading}>
              Cancel
            </button>
            <button type="submit" className="btn-submit" disabled={isLoading}>
              {isLoading ? 'Saving...' : editService ? 'Update' : 'Add Service'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
