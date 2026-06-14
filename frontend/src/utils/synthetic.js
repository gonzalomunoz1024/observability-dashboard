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

export async function probeRequest({ url, method, body, headers }) {
  const response = await fetch(`${BACKEND_URL}/api/synthetic/rest/probe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, method, body, headers }),
  });

  if (!response.ok) {
    let message = 'Failed to probe request';
    try {
      const error = await response.json();
      message = error.error || error.message || message;
    } catch { /* keep default */ }
    throw new Error(message);
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

export async function listTransactions() {
  const response = await fetch(`${BACKEND_URL}/api/synthetic/transactions`);
  if (!response.ok) throw new Error('Failed to load transactions');
  return response.json();
}

export async function createTransaction(payload) {
  const response = await fetch(`${BACKEND_URL}/api/synthetic/transactions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await safeJson(response);
    throw new Error(err.error || err.message || 'Failed to create transaction');
  }
  return response.json();
}

export async function updateTransaction(id, payload) {
  const response = await fetch(`${BACKEND_URL}/api/synthetic/transactions/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const err = await safeJson(response);
    throw new Error(err.error || err.message || 'Failed to update transaction');
  }
  return response.json();
}

export async function deleteTransaction(id) {
  const response = await fetch(`${BACKEND_URL}/api/synthetic/transactions/${id}`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const err = await safeJson(response);
    throw new Error(err.error || err.message || 'Failed to delete transaction');
  }
}

export async function runTransaction(id) {
  const response = await fetch(`${BACKEND_URL}/api/synthetic/transactions/${id}/run`, {
    method: 'POST',
  });
  if (!response.ok) {
    const err = await safeJson(response);
    throw new Error(err.error || err.message || 'Failed to run transaction');
  }
  return response.json();
}

export async function listRuns({ transactionId, limit = 50 } = {}) {
  const params = new URLSearchParams();
  if (transactionId != null) params.set('transactionId', transactionId);
  params.set('limit', String(limit));
  const response = await fetch(`${BACKEND_URL}/api/synthetic/runs?${params.toString()}`);
  if (!response.ok) throw new Error('Failed to load runs');
  return response.json();
}

export async function getRun(id) {
  const response = await fetch(`${BACKEND_URL}/api/synthetic/runs/${id}`);
  if (!response.ok) throw new Error('Failed to load run');
  return response.json();
}

async function safeJson(response) {
  try { return await response.json(); } catch { return {}; }
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
