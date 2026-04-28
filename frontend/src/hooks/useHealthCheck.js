import { useEffect, useRef, useCallback } from 'react';
import { useServicesDispatch, useServices } from '../context/ServicesContext';
import { checkHealth } from '../utils/healthChecker';

export function useHealthCheck() {
  const { services } = useServices();
  const dispatch = useServicesDispatch();
  const intervalsRef = useRef({});

  const checkService = useCallback(async (service) => {
    dispatch({
      type: 'UPDATE_STATUS',
      payload: {
        id: service.id,
        status: { status: 'checking', lastChecked: new Date().toISOString() },
      },
    });

    const result = await checkHealth(service);

    dispatch({
      type: 'UPDATE_STATUS',
      payload: {
        id: service.id,
        status: result,
      },
    });

    return result;
  }, [dispatch]);

  const startPolling = useCallback((service) => {
    if (intervalsRef.current[service.id]) {
      clearInterval(intervalsRef.current[service.id]);
    }

    checkService(service);

    const interval = setInterval(() => {
      checkService(service);
    }, service.interval || 30000);

    intervalsRef.current[service.id] = interval;
  }, [checkService]);

  const stopPolling = useCallback((serviceId) => {
    if (intervalsRef.current[serviceId]) {
      clearInterval(intervalsRef.current[serviceId]);
      delete intervalsRef.current[serviceId];
    }
  }, []);

  useEffect(() => {
    const intervals = intervalsRef.current;

    // Only poll services that have a URL configured (skip CLI services)
    services.forEach((service) => {
      if (!service.url) return; // Skip services without health check URLs
      if (!intervals[service.id]) {
        startPolling(service);
      }
    });

    Object.keys(intervals).forEach((id) => {
      if (!services.find((s) => s.id === id)) {
        stopPolling(id);
      }
    });

    return () => {
      Object.keys(intervals).forEach((id) => {
        clearInterval(intervals[id]);
      });
    };
  }, [services, startPolling, stopPolling]);

  return { checkService };
}
