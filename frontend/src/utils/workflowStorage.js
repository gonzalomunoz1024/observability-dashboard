const STORAGE_KEY = 'cli-workflows';

export function getSavedWorkflows() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveWorkflow(workflow) {
  const workflows = getSavedWorkflows();
  const existing = workflows.findIndex((w) => w.id === workflow.id);

  const workflowWithMeta = {
    ...workflow,
    id: workflow.id || `workflow-${Date.now()}`,
    savedAt: new Date().toISOString(),
  };

  if (existing >= 0) {
    workflows[existing] = workflowWithMeta;
  } else {
    workflows.unshift(workflowWithMeta);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(workflows));
  return workflowWithMeta;
}

export function deleteWorkflow(id) {
  const workflows = getSavedWorkflows();
  const filtered = workflows.filter((w) => w.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function getWorkflowById(id) {
  const workflows = getSavedWorkflows();
  return workflows.find((w) => w.id === id);
}

// Execution History Storage
const HISTORY_KEY = 'cli-execution-history';
const MAX_HISTORY = 50;

export function getExecutionHistory() {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

export function saveExecutionResult(result) {
  const history = getExecutionHistory();
  history.unshift(result);
  // Keep only the most recent results
  const trimmed = history.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  return trimmed;
}

export function clearExecutionHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
}
