import { useState, memo, useCallback } from 'react';
import { useServices, useServicesDispatch } from '../../context/ServicesContext';
import { ServiceCard } from '../Dashboard/ServiceCard';
import { SyntheticPanel } from '../Synthetic/SyntheticPanel';
import { LoadTestPanel } from '../LoadTest/LoadTestPanel';
import { CLIPanel } from '../CLI/CLIPanel';
import { AlertingPanel } from '../Alerting/AlertingPanel';
import { useHealthCheck } from '../../hooks/useHealthCheck';
import './ServiceView.css';

/**
 * ServiceView - Service Detail Page
 * Tabbed interface for service management
 */
export const ServiceView = memo(function ServiceView({ serviceId }) {
  const { services, statuses } = useServices();
  const dispatch = useServicesDispatch();
  const { checkService } = useHealthCheck();

  const service = services.find(s => s.id === serviceId);
  const status = statuses[serviceId];

  const [activeTab, setActiveTab] = useState(
    service?.type === 'cli' ? 'cli' : 'health'
  );

  const handleDelete = useCallback(() => {
    if (window.confirm(`Delete "${service?.name}"?`)) {
      dispatch({ type: 'DELETE_SERVICE', payload: service.id });
    }
  }, [dispatch, service]);

  if (!service) {
    return (
      <div className="service-view">
        <div className="not-found">
          <h2>Service not found</h2>
          <p>The requested service could not be found.</p>
        </div>
      </div>
    );
  }

  const isRest = service.type === 'rest';

  const tabs = isRest
    ? [
        { id: 'health', label: 'Health' },
        { id: 'synthetic', label: 'Synthetic' },
        { id: 'loadtest', label: 'Load Testing' },
        { id: 'alerts', label: 'Alerts' },
      ]
    : [{ id: 'cli', label: 'Regression Suite' }];

  return (
    <div className="service-view">
      <div className="service-header">
        <div className="header-info">
          <h2>{service.name}</h2>
          <span className={`type-badge ${service.type}`}>
            {isRest ? 'API' : 'CLI'}
          </span>
        </div>
        <button className="delete-service-btn" onClick={handleDelete}>
          Delete
        </button>
      </div>

      <div className="tabs">
        {tabs.map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="tab-content">
        {activeTab === 'health' && isRest && (
          <div className="health-content">
            <ServiceCard
              service={service}
              status={status}
              onCheckNow={() => checkService(service)}
            />
          </div>
        )}

        {activeTab === 'synthetic' && isRest && (
          <SyntheticPanel />
        )}

        {activeTab === 'loadtest' && isRest && (
          <LoadTestPanel />
        )}

        {activeTab === 'alerts' && isRest && (
          <AlertingPanel serviceId={serviceId} />
        )}

        {activeTab === 'cli' && !isRest && (
          <CLIPanel serviceId={serviceId} />
        )}
      </div>
    </div>
  );
});
