const STORAGE_KEY = 'dashboard_services';

export function loadServices() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];

    const services = JSON.parse(stored);
    // Migrate old services without type to 'rest'
    return services.map(service => ({
      ...service,
      type: service.type || 'rest'
    }));
  } catch (error) {
    console.error('Failed to load services from localStorage:', error);
    return [];
  }
}

export function saveServices(services) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(services));
  } catch (error) {
    console.error('Failed to save services to localStorage:', error);
  }
}
