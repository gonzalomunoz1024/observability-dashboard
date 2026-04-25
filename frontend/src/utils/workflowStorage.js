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
