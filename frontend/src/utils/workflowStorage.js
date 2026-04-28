const STORAGE_KEY = 'cli-workflows';

export function getSavedWorkflows(serviceId = null) {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const workflows = data ? JSON.parse(data) : [];
    if (serviceId) {
      return workflows.filter(w => w.serviceId === serviceId);
    }
    return workflows;
  } catch {
    return [];
  }
}

export function saveWorkflow(workflow, serviceId = null) {
  const workflows = getSavedWorkflows(); // Get all workflows for storage
  const existing = workflows.findIndex((w) => w.id === workflow.id);

  const workflowWithMeta = {
    ...workflow,
    id: workflow.id || `workflow-${Date.now()}`,
    serviceId: serviceId || workflow.serviceId,
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

export function getExecutionHistory(serviceId = null) {
  try {
    const data = localStorage.getItem(HISTORY_KEY);
    const history = data ? JSON.parse(data) : [];
    if (serviceId) {
      return history.filter(h => h.serviceId === serviceId);
    }
    return history;
  } catch {
    return [];
  }
}

export function saveExecutionResult(result, serviceId = null) {
  const history = getExecutionHistory(); // Get all history for storage
  const resultWithService = {
    ...result,
    serviceId: serviceId || result.serviceId,
  };
  history.unshift(resultWithService);
  // Keep only the most recent results
  const trimmed = history.slice(0, MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  // Return filtered results for the current service
  return serviceId ? trimmed.filter(h => h.serviceId === serviceId) : trimmed;
}

export function clearExecutionHistory(serviceId = null) {
  if (serviceId) {
    const history = getExecutionHistory();
    const filtered = history.filter(h => h.serviceId !== serviceId);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered));
  } else {
    localStorage.setItem(HISTORY_KEY, JSON.stringify([]));
  }
}

// Export workflows as JSON collection
export function exportWorkflows(serviceId) {
  const workflows = getSavedWorkflows(serviceId);
  // Remove serviceId from exported workflows so they can be imported to any service
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    workflows: workflows.map(({ serviceId: _, ...workflow }) => workflow),
  };
  return JSON.stringify(exportData, null, 2);
}

// Import workflows from JSON collection
export function importWorkflows(jsonString, serviceId) {
  try {
    const data = JSON.parse(jsonString);
    const importedWorkflows = data.workflows || data; // Support both wrapped and raw array formats

    if (!Array.isArray(importedWorkflows)) {
      throw new Error('Invalid format: expected an array of workflows');
    }

    const results = { imported: 0, skipped: 0, errors: [] };

    importedWorkflows.forEach((workflow, index) => {
      try {
        if (!workflow.name || !workflow.steps) {
          results.errors.push(`Workflow ${index + 1}: Missing required fields (name, steps)`);
          results.skipped++;
          return;
        }
        // Generate new ID to avoid conflicts, assign to current service
        saveWorkflow({
          ...workflow,
          id: `workflow-${Date.now()}-${index}`,
        }, serviceId);
        results.imported++;
      } catch (err) {
        results.errors.push(`Workflow ${index + 1}: ${err.message}`);
        results.skipped++;
      }
    });

    return results;
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${err.message}`);
  }
}
