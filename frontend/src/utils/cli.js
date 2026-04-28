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
    let errorMessage = 'Failed to run workflow';
    try {
      const error = await response.json();
      errorMessage = error.message || error.error || errorMessage;
    } catch {
      const text = await response.text();
      errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// Workflow execution with progress callbacks (uses regular endpoint, animates results)
export async function runWorkflowWithProgress(workflow, onStepStart, onStepComplete, onError) {
  const url = `${PROXY_URL}/api/cli/workflow`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(workflow),
  });

  if (!response.ok) {
    let errorMessage = 'Failed to run workflow';
    try {
      const error = await response.json();
      errorMessage = error.message || error.error || errorMessage;
    } catch {
      const text = await response.text();
      errorMessage = text || `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  return response.json();
}

// Workflow execution with SSE streaming for live output
export function runWorkflowStreaming(workflow, callbacks) {
  const { onStart, onStepStart, onOutput, onStepComplete, onComplete, onError, onStreamId, onCapture } = callbacks;

  return new Promise((resolve, reject) => {
    fetch(`${PROXY_URL}/api/cli/workflow/stream`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow),
    }).then(response => {
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get streamId from response header for cancellation
      const streamId = response.headers.get('X-Stream-Id');
      if (streamId && onStreamId) {
        onStreamId(streamId);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      function processEvents() {
        reader.read().then(({ done, value }) => {
          if (done) {
            resolve();
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = null;
          let currentData = '';

          lines.forEach(line => {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7);
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6);
              if (currentEvent && currentData) {
                try {
                  const data = JSON.parse(currentData);
                  switch (currentEvent) {
                    case 'start':
                      onStart?.(data);
                      break;
                    case 'stepStart':
                      onStepStart?.(data.stepId, data);
                      break;
                    case 'output':
                      onOutput?.(data.stepId, data);
                      break;
                    case 'stepComplete':
                      onStepComplete?.(data.stepId, data.result);
                      break;
                    case 'capture':
                      onCapture?.(data.varName, data.value, data.stepId);
                      break;
                    case 'complete':
                      onComplete?.(data);
                      break;
                    case 'error':
                      onError?.(data.message);
                      break;
                    default:
                      break;
                  }
                } catch (e) {
                  console.warn('Failed to parse SSE data:', e);
                }
              }
              currentEvent = null;
              currentData = '';
            }
          });

          processEvents();
        }).catch(err => {
          onError?.(err.message);
          reject(err);
        });
      }

      processEvents();
    }).catch(err => {
      onError?.(err.message);
      reject(err);
    });
  });
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

export async function cancelWorkflow(streamId) {
  const response = await fetch(`${PROXY_URL}/api/cli/workflow/cancel/${streamId}`, {
    method: 'POST',
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || error.error || 'Failed to cancel workflow');
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
