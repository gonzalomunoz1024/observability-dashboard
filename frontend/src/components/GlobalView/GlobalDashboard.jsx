import { memo } from 'react';
import { useServices } from '../../context/ServicesContext';
import { StatusIndicator } from '../Dashboard/StatusIndicator';
import './GlobalDashboard.css';

/**
 * GlobalDashboard - System Overview
 * Clean metrics display with service cards
 */
export const GlobalDashboard = memo(function GlobalDashboard({
  onSelectService,
  onAddService
}) {
  const { services, statuses } = useServices();

  const restServices = services.filter(s => s.type === 'rest');
  const cliServices = services.filter(s => s.type === 'cli');

  // Only count REST services for health stats (CLI tools don't have health status)
  const healthyCount = restServices.filter(s => statuses[s.id]?.status === 'healthy').length;
  const unhealthyCount = restServices.filter(s => statuses[s.id]?.status === 'unhealthy').length;
  const unknownCount = restServices.length - healthyCount - unhealthyCount;

  const getStatusClass = (serviceId) => {
    const status = statuses[serviceId]?.status;
    if (status === 'healthy') return 'healthy';
    if (status === 'unhealthy') return 'unhealthy';
    if (status === 'checking') return 'checking';
    return 'unknown';
  };

  if (services.length === 0) {
    return (
      <div className="global-dashboard">
        <div className="dashboard-header">
          <h2>Welcome</h2>
          <p>Add your first service to begin monitoring</p>
        </div>
        <div className="empty-state" onClick={onAddService}>
          <div className="empty-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <h3>Add Service</h3>
          <p>Monitor REST APIs or validate CLI tools</p>
        </div>
      </div>
    );
  }

  return (
    <div className="global-dashboard">
      <div className="dashboard-header">
        <h2>Dashboard</h2>
        <p>Overview of all monitored services</p>
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <span className="stat-value">{restServices.length}</span>
          <span className="stat-label">Total</span>
        </div>
        <div className="stat-card healthy">
          <span className="stat-value">{healthyCount}</span>
          <span className="stat-label">Healthy</span>
        </div>
        <div className="stat-card unhealthy">
          <span className="stat-value">{unhealthyCount}</span>
          <span className="stat-label">Unhealthy</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{unknownCount}</span>
          <span className="stat-label">Unknown</span>
        </div>
      </div>

      {restServices.length > 0 && (
        <div className="services-section">
          <h3>REST Services</h3>
          <div className="services-grid">
            {restServices.map(service => (
              <div
                key={service.id}
                className={`service-card ${getStatusClass(service.id)}`}
                onClick={() => onSelectService(service.id)}
              >
                <div className="card-header">
                  <span className="card-title">{service.name}</span>
                  <StatusIndicator status={getStatusClass(service.id)} />
                </div>
                <div className="card-url">{service.url}</div>
                <div className="card-stats">
                  {statuses[service.id]?.responseTime != null && (
                    <span className="card-stat">
                      {statuses[service.id].responseTime}ms
                    </span>
                  )}
                  {statuses[service.id]?.statusCode && (
                    <span className="card-stat">
                      {statuses[service.id].statusCode}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {cliServices.length > 0 && (
        <div className="services-section">
          <h3>CLI Tools</h3>
          <div className="services-grid">
            {cliServices.map(service => (
              <div
                key={service.id}
                className="service-card cli"
                onClick={() => onSelectService(service.id)}
              >
                <div className="card-header">
                  <span className="card-title">{service.name}</span>
                  <span className="status-dot cli" />
                </div>
                <div className="card-url">{service.executable || 'No executable'}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
