// Synthetic endpoints live on the Spring Boot backend, not the CLI proxy (:3001).
const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || window.location.origin;

export async function injectEvent(topic, eventType, payload = {}) {
  const response = await fetch(`${BACKEND_URL}/api/synthetic/inject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, eventType, payload }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to inject event');
  }

  return response.json();
}

export async function traceEventFlow(correlationId, expectedFlow, options = {}) {
  const { index, timeout } = options;

  const response = await fetch(`${BACKEND_URL}/api/synthetic/trace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ correlationId, expectedFlow, index, timeout }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to trace event flow');
  }

  return response.json();
}

export async function getEventsByCorrelationId(correlationId, index) {
  const url = new URL(`${BACKEND_URL}/api/synthetic/events/${correlationId}`);
  if (index) url.searchParams.set('index', index);

  const response = await fetch(url);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to fetch events');
  }

  return response.json();
}

export async function restInjectAndCheck(config) {
  const response = await fetch(`${BACKEND_URL}/api/synthetic/rest/inject-and-check`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || error.message || 'Failed to run REST inject and check');
  }

  return response.json();
}

export async function injectAndTrace(topic, eventType, expectedFlow, options = {}) {
  const { payload, index, timeout } = options;

  const response = await fetch(`${BACKEND_URL}/api/synthetic/inject-and-trace`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ topic, eventType, payload, expectedFlow, index, timeout }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to inject and trace event');
  }

  return response.json();
}
