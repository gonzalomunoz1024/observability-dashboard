import { memo, useCallback } from 'react';
import { StatusIndicator } from './StatusIndicator';
import { useServicesDispatch } from '../../context/ServicesContext';
import './ServiceCard.css';

/**
 * ServiceCard - Health status detail card
 * Shows service metrics and actions
 */
export const ServiceCard = memo(function ServiceCard({ service, status, onCheckNow }) {
  const dispatch = useServicesDispatch();

  const handleDelete = useCallback(() => {
    if (window.confirm(`Delete "${service.name}"?`)) {
      dispatch({ type: 'DELETE_SERVICE', payload: service.id });
    }
  }, [dispatch, service]);

  const formatTime = (date) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleTimeString();
  };

  return (
    <div className={`service-card status-border-${status?.status || 'unknown'}`}>
      <div className="card-header">
        <h3 className="service-name">{service.name}</h3>
        <StatusIndicator status={status?.status || 'unknown'} />
      </div>

      <div className="card-url">{service.url}</div>

      <div className="card-stats">
        <div className="stat-item">
          <span className="stat-label">Response</span>
          <span className="stat-value">
            {status?.responseTime != null ? `${status.responseTime}ms` : '-'}
          </span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Status</span>
          <span className="stat-value">{status?.statusCode || '-'}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Checked</span>
          <span className="stat-value">{formatTime(status?.lastChecked)}</span>
        </div>
      </div>

      {status?.error && (
        <div className="card-error">{status.error}</div>
      )}

      <div className="card-actions">
        <button className="action-btn check-btn" onClick={onCheckNow}>
          Check Now
        </button>
        <button className="action-btn delete-btn" onClick={handleDelete}>
          Delete
        </button>
      </div>
    </div>
  );
});
