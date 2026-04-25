import { useServices } from '../../context/ServicesContext';
import './HealthSummary.css';

export function HealthSummary() {
  const { services, statuses } = useServices();

  if (services.length === 0) {
    return null;
  }

  const healthyCount = Object.values(statuses).filter(
    (s) => s?.status === 'healthy'
  ).length;
  const unhealthyCount = Object.values(statuses).filter(
    (s) => s?.status === 'unhealthy'
  ).length;
  const unknownCount = services.length - healthyCount - unhealthyCount;

  const avgResponseTime =
    Object.values(statuses).filter((s) => s?.responseTime != null).length > 0
      ? Math.round(
          Object.values(statuses)
            .filter((s) => s?.responseTime != null)
            .reduce((sum, s) => sum + s.responseTime, 0) /
            Object.values(statuses).filter((s) => s?.responseTime != null).length
        )
      : null;

  const unhealthyServices = services.filter(
    (service) => statuses[service.id]?.status === 'unhealthy'
  );

  const getStatusClass = (serviceId) => {
    const status = statuses[serviceId]?.status;
    if (status === 'healthy') return 'healthy';
    if (status === 'unhealthy') return 'unhealthy';
    if (status === 'checking') return 'checking';
    return 'unknown';
  };

  return (
    <div className="health-summary">
      <div className="summary-header">
        <h2 className="summary-title">System Health</h2>
      </div>

      <div className="health-matrix">
        {services.map((service) => (
          <div
            key={service.id}
            className={`matrix-cell ${getStatusClass(service.id)}`}
            title={`${service.name}: ${statuses[service.id]?.status || 'unknown'}`}
          />
        ))}
      </div>

      <div className="stats-row">
        <span className="stat-badge healthy">{healthyCount} Healthy</span>
        <span className="stat-badge unhealthy">{unhealthyCount} Unhealthy</span>
        <span className="stat-badge unknown">{unknownCount} Unknown</span>
        {avgResponseTime != null && (
          <span className="stat-badge response">Avg: {avgResponseTime}ms</span>
        )}
      </div>

      {unhealthyServices.length > 0 && (
        <div className="issues-section">
          <span className="issues-label">Issues:</span>
          {unhealthyServices.map((service, index) => (
            <span key={service.id} className="issue-item">
              {service.name}
              {statuses[service.id]?.error && ` (${statuses[service.id].error})`}
              {index < unhealthyServices.length - 1 && ', '}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
