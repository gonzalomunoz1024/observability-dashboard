import { useState } from 'react';
import {
  enableMonitoredService,
  disableMonitoredService,
  resetAlertState,
} from '../../utils/monitoredServices';
import './MonitoredServiceCard.css';

export function MonitoredServiceCard({ service, onEdit, onDelete, onRefresh }) {
  const [isToggling, setIsToggling] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const formatTime = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  const handleToggleEnabled = async () => {
    setIsToggling(true);
    try {
      if (service.enabled) {
        await disableMonitoredService(service.id);
      } else {
        await enableMonitoredService(service.id);
      }
      onRefresh();
    } catch (err) {
      console.error('Failed to toggle service:', err);
    } finally {
      setIsToggling(false);
    }
  };

  const handleResetAlert = async () => {
    setIsResetting(true);
    try {
      await resetAlertState(service.id);
      onRefresh();
    } catch (err) {
      console.error('Failed to reset alert:', err);
    } finally {
      setIsResetting(false);
    }
  };

  const statusClass = service.enabled
    ? service.currentStatus || 'unknown'
    : 'disabled';

  return (
    <div className={`service-card status-${statusClass}`}>
      <div className="card-header">
        <div className="service-info">
          <h3 className="service-name">{service.name}</h3>
          <span className="service-url">{service.url}</span>
        </div>
        <div className="status-badge">
          <span className={`status-dot ${statusClass}`}></span>
          <span className="status-text">
            {!service.enabled ? 'Disabled' : service.currentStatus || 'Unknown'}
          </span>
        </div>
      </div>

      <div className="card-stats">
        <div className="stat">
          <span className="stat-label">Last Check</span>
          <span className="stat-value">{formatTime(service.lastCheckTime)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Last Success</span>
          <span className="stat-value">{formatTime(service.lastSuccessTime)}</span>
        </div>
        <div className="stat">
          <span className="stat-label">Failures</span>
          <span className={`stat-value ${service.consecutiveFailures > 0 ? 'warning' : ''}`}>
            {service.consecutiveFailures}
          </span>
        </div>
      </div>

      {service.alertSent && (
        <div className="alert-banner">
          <span className="alert-icon">!</span>
          <span>Alert sent - service is being monitored</span>
          <button
            className="btn-reset"
            onClick={handleResetAlert}
            disabled={isResetting}
          >
            {isResetting ? '...' : 'Reset'}
          </button>
        </div>
      )}

      {service.lastError && (
        <div className="error-display">
          <span className="error-label">Last Error:</span>
          <span className="error-message">{service.lastError}</span>
        </div>
      )}

      <div className="card-meta">
        <span className="meta-item">
          Check every {service.checkIntervalSeconds}s
        </span>
        <span className="meta-item">
          {service.alertRecipients?.length || 0} recipient(s)
        </span>
      </div>

      <div className="card-actions">
        <button
          className={`btn-toggle ${service.enabled ? 'enabled' : 'disabled'}`}
          onClick={handleToggleEnabled}
          disabled={isToggling}
        >
          {isToggling ? '...' : service.enabled ? 'Disable' : 'Enable'}
        </button>
        <button className="btn-edit" onClick={onEdit}>
          Edit
        </button>
        <button className="btn-delete" onClick={onDelete}>
          Delete
        </button>
      </div>
    </div>
  );
}
