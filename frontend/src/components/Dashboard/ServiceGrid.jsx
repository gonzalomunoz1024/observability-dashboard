import { ServiceCard } from './ServiceCard';
import { useServices } from '../../context/ServicesContext';
import './ServiceGrid.css';

export function ServiceGrid({ onCheckService, onAddService }) {
  const { services, statuses } = useServices();

  if (services.length === 0) {
    return (
      <div className="empty-state" onClick={onAddService} role="button" tabIndex={0}>
        <div className="empty-icon">+</div>
        <h2>No services configured</h2>
        <p>Add your first service to start monitoring</p>
      </div>
    );
  }

  return (
    <div className="service-grid">
      {services.map((service) => (
        <ServiceCard
          key={service.id}
          service={service}
          status={statuses[service.id]}
          onCheckNow={() => onCheckService(service)}
        />
      ))}
    </div>
  );
}
