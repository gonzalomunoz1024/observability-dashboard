import { memo } from 'react';
import './ServiceItem.css';

/**
 * ServiceItem - Navigation service entry
 * Clean design with subtle status indication
 */
export const ServiceItem = memo(function ServiceItem({
  service,
  status,
  isActive,
  onClick,
  collapsed
}) {
  const isCli = service.type === 'cli';
  const statusClass = isCli ? 'cli' : (status?.status || 'unknown');

  return (
    <button
      className={`service-item ${statusClass} ${isActive ? 'active' : ''} ${collapsed ? 'collapsed' : ''}`}
      onClick={onClick}
      title={service.name}
    >
      <span className={`status-dot ${statusClass}`} />
      {!collapsed && (
        <span className="service-name">{service.name}</span>
      )}
    </button>
  );
});
