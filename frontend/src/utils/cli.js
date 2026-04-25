const PROXY_URL = process.env.REACT_APP_PROXY_URL || 'http://localhost:3001';

export async function executeCommand(executable, args = [], options = {}) {
  const response = await fetch(`${PROXY_URL}/api/cli/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ executable, args, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to execute command');
  }

  return response.json();
}

export async function validateCommand(executable, args = [], expectations = {}, options = {}) {
  const response = await fetch(`${PROXY_URL}/api/cli/validate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ executable, args, expectations, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to validate command');
  }

  return response.json();
}

export async function runTestSuite(executable, tests = [], options = {}) {
  const response = await fetch(`${PROXY_URL}/api/cli/suite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ executable, tests, ...options }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to run test suite');
  }

  return response.json();
}

export async function runWorkflow(workflow) {
  const response = await fetch(`${PROXY_URL}/api/cli/workflow`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to run workflow');
  }

  return response.json();
}

export async function runSuiteParallel(name, tests = []) {
  const response = await fetch(`${PROXY_URL}/api/cli/suite/parallel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, tests }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to run parallel suite');
  }

  return response.json();
}

export async function uploadExecutable(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch(`${PROXY_URL}/api/cli/executable/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error || 'Failed to upload executable');
  }

  return response.json();
}
