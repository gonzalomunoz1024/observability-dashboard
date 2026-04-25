import { useServices } from '../../context/ServicesContext';
import './Header.css';

export function Header({ onAddService }) {
  const { services, statuses } = useServices();

  const healthyCount = Object.values(statuses).filter(
    (s) => s?.status === 'healthy'
  ).length;
  const unhealthyCount = Object.values(statuses).filter(
    (s) => s?.status === 'unhealthy'
  ).length;

  return (
    <header className="header">
      <div className="header-content">
        <h1 className="header-title">API Status Dashboard</h1>
        <div className="header-stats">
          {services.length > 0 && (
            <>
              <span className="stat healthy">{healthyCount} healthy</span>
              <span className="stat unhealthy">{unhealthyCount} unhealthy</span>
              <span className="stat total">{services.length} total</span>
            </>
          )}
        </div>
      </div>
      <button className="add-button" onClick={onAddService}>
        + Add Service
      </button>
    </header>
  );
}
