import { useState, useEffect, useCallback } from 'react';
import { MonitoredServiceForm } from './MonitoredServiceForm';
import { MonitoredServiceCard } from './MonitoredServiceCard';
import {
  getMonitoredServices,
  registerMonitoredService,
  updateMonitoredService,
  deleteMonitoredService,
  triggerHealthCheck,
} from '../../utils/monitoredServices';
import './AlertingPanel.css';

export function AlertingPanel() {
  const [services, setServices] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCheckingNow, setIsCheckingNow] = useState(false);

  const fetchServices = useCallback(async () => {
    try {
      setError(null);
      const data = await getMonitoredServices();
      setServices(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchServices();
    // Refresh every 30 seconds
    const interval = setInterval(fetchServices, 30000);
    return () => clearInterval(interval);
  }, [fetchServices]);

  const handleAddService = async (serviceData) => {
    setIsSubmitting(true);
    try {
      await registerMonitoredService(serviceData);
      await fetchServices();
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateService = async (serviceData) => {
    setIsSubmitting(true);
    try {
      await updateMonitoredService(editingService.id, serviceData);
      await fetchServices();
      setEditingService(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteService = async (id) => {
    if (!window.confirm('Are you sure you want to delete this service?')) return;

    try {
      await deleteMonitoredService(id);
      setServices((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCheckNow = async () => {
    setIsCheckingNow(true);
    try {
      await triggerHealthCheck();
      // Wait a moment then refresh to show updated status
      setTimeout(fetchServices, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsCheckingNow(false);
    }
  };

  const healthyCount = services.filter((s) => s.currentStatus === 'healthy').length;
  const unhealthyCount = services.filter((s) => s.currentStatus === 'unhealthy').length;
  const alertingCount = services.filter((s) => s.alertSent).length;

  return (
    <div className="alerting-panel">
      <div className="panel-header">
        <div className="header-info">
          <h2>Email Alerts</h2>
          <p className="header-description">
            Server-side health monitoring with email notifications after 3 consecutive failures.
          </p>
        </div>
        <div className="header-actions">
          <button
            className="btn-secondary"
            onClick={handleCheckNow}
            disabled={isCheckingNow || services.length === 0}
          >
            {isCheckingNow ? 'Checking...' : 'Check Now'}
          </button>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            + Add Service
          </button>
        </div>
      </div>

      {error && (
        <div className="error-banner">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      <div className="status-summary">
        <div className="status-item">
          <span className="status-count">{services.length}</span>
          <span className="status-label">Total</span>
        </div>
        <div className="status-item healthy">
          <span className="status-count">{healthyCount}</span>
          <span className="status-label">Healthy</span>
        </div>
        <div className="status-item unhealthy">
          <span className="status-count">{unhealthyCount}</span>
          <span className="status-label">Unhealthy</span>
        </div>
        <div className="status-item alerting">
          <span className="status-count">{alertingCount}</span>
          <span className="status-label">Alerting</span>
        </div>
      </div>

      {isLoading ? (
        <div className="loading">Loading services...</div>
      ) : services.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">+</div>
          <h3>No Monitored Services</h3>
          <p>Add a service to start monitoring with email alerts.</p>
          <button className="btn-primary" onClick={() => setShowForm(true)}>
            Add Your First Service
          </button>
        </div>
      ) : (
        <div className="services-grid">
          {services.map((service) => (
            <MonitoredServiceCard
              key={service.id}
              service={service}
              onEdit={() => setEditingService(service)}
              onDelete={() => handleDeleteService(service.id)}
              onRefresh={fetchServices}
            />
          ))}
        </div>
      )}

      {showForm && (
        <MonitoredServiceForm
          onClose={() => setShowForm(false)}
          onSubmit={handleAddService}
          isLoading={isSubmitting}
        />
      )}

      {editingService && (
        <MonitoredServiceForm
          onClose={() => setEditingService(null)}
          onSubmit={handleUpdateService}
          editService={editingService}
          isLoading={isSubmitting}
        />
      )}
    </div>
  );
}
