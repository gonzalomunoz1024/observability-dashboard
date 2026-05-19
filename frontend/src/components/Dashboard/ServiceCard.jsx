import { memo, useCallback } from 'react';
import { StatusIndicator } from './StatusIndicator';
import { useServicesDispatch } from '../../context/ServicesContext';
import './ServiceCard.css';

/**
 * ServiceCard - Health status detail card
 * Shows service metrics and actions
 */
export const ServiceCard = memo(function ServiceCard({ service, status, onCheckNow, onEdit }) {
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
        {onEdit && (
          <button
            className="action-btn edit-btn"
            onClick={onEdit}
            title="Edit service"
            aria-label="Edit service"
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <path
                d="M11.5 2.5a1.414 1.414 0 0 1 2 2L5 13l-3 1 1-3 8.5-8.5z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        )}
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
