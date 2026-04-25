const PROXY_URL = process.env.REACT_APP_PROXY_URL || 'http://localhost:3001';

export async function getMonitoredServices() {
  const response = await fetch(`${PROXY_URL}/api/monitored-services`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch monitored services');
  }

  return response.json();
}

export async function getMonitoredService(id) {
  const response = await fetch(`${PROXY_URL}/api/monitored-services/${id}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch monitored service');
  }

  return response.json();
}

export async function registerMonitoredService(service) {
  const response = await fetch(`${PROXY_URL}/api/monitored-services`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(service),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to register monitored service');
  }

  return response.json();
}

export async function updateMonitoredService(id, service) {
  const response = await fetch(`${PROXY_URL}/api/monitored-services/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(service),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to update monitored service');
  }

  return response.json();
}

export async function deleteMonitoredService(id) {
  const response = await fetch(`${PROXY_URL}/api/monitored-services/${id}`, {
    method: 'DELETE',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to delete monitored service');
  }
}

export async function enableMonitoredService(id) {
  const response = await fetch(`${PROXY_URL}/api/monitored-services/${id}/enable`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to enable monitored service');
  }

  return response.json();
}

export async function disableMonitoredService(id) {
  const response = await fetch(`${PROXY_URL}/api/monitored-services/${id}/disable`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to disable monitored service');
  }

  return response.json();
}

export async function triggerHealthCheck() {
  const response = await fetch(`${PROXY_URL}/api/monitored-services/check-now`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to trigger health check');
  }

  return response.json();
}

export async function resetAlertState(id) {
  const response = await fetch(`${PROXY_URL}/api/monitored-services/${id}/reset-alert`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to reset alert state');
  }
}

export async function sendTestEmail(recipients, serviceName) {
  const response = await fetch(`${PROXY_URL}/api/monitored-services/test-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipients, serviceName }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to send test email');
  }

  return response.json();
}
