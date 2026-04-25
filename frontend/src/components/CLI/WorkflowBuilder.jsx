import { useState, useEffect } from 'react';
import { StepConfig } from './StepConfig';
import { WorkflowGraph } from './WorkflowGraph';
import { getSavedWorkflows, saveWorkflow, deleteWorkflow } from '../../utils/workflowStorage';
import './WorkflowBuilder.css';

const defaultStep = {
  id: '',
  name: '',
  type: 'command',
  args: '',
  timeout: 30000,
  dependsOn: '',
  stdinInputs: '',
  stdinDelay: 100,
  expectations: {
    exitCode: 0,
    stdoutContains: '',
    stdoutMatches: '',
    stderrEmpty: false,
    stderrContains: '',
    maxDuration: '',
  },
  capture: '',
  artifacts: '',
  http: {
    method: 'GET',
    url: '',
    headers: '',
    body: '',
    polling: { enabled: false, intervalSeconds: 30, maxDurationMinutes: 60 },
    expect: { statusCode: 200, bodyContains: '', jsonPath: '' },
    capture: '',
  },
};

export function WorkflowBuilder({ onSave: onSaveCallback, onSaveComplete, initialWorkflow, onCancelEdit }) {
  const [workflowId, setWorkflowId] = useState(null);
  const [workflowName, setWorkflowName] = useState('');
  const [envVars, setEnvVars] = useState('');
  const [steps, setSteps] = useState([{ ...defaultStep, id: 'Step 1' }]);
  const [error, setError] = useState(null);
  const [savedWorkflows, setSavedWorkflows] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [showGraph, setShowGraph] = useState(false);

  useEffect(() => {
    setSavedWorkflows(getSavedWorkflows());
  }, []);

  // Load initial workflow when provided (for editing)
  useEffect(() => {
    if (initialWorkflow) {
      setWorkflowId(initialWorkflow.id);
      setWorkflowName(initialWorkflow.name);
      setEnvVars(initialWorkflow.envVars || '');
      setSteps(initialWorkflow.steps || [{ ...defaultStep, id: 'Step 1' }]);
    }
  }, [initialWorkflow]);

  const handleSave = () => {
    if (!workflowName.trim()) {
      setError('Please enter a workflow name to save');
      return;
    }
    const saved = saveWorkflow({
      id: workflowId,
      name: workflowName,
      envVars,
      steps,
    });
    setWorkflowId(saved.id);
    setSavedWorkflows(getSavedWorkflows());
    setError(null);
    if (onSaveCallback) {
      onSaveCallback();
    }
    if (onSaveComplete) {
      onSaveComplete();
    }
  };

  const handleLoad = (workflow) => {
    setWorkflowId(workflow.id);
    setWorkflowName(workflow.name);
    setEnvVars(workflow.envVars || '');
    setSteps(workflow.steps || [{ ...defaultStep, id: 'Step 1' }]);
    setShowSaved(false);
  };

  const handleDelete = (id) => {
    deleteWorkflow(id);
    setSavedWorkflows(getSavedWorkflows());
    if (workflowId === id) {
      setWorkflowId(null);
    }
  };

  const handleNew = () => {
    setWorkflowId(null);
    setWorkflowName('');
    setEnvVars('');
    setSteps([{ ...defaultStep, id: 'Step 1' }]);
    setError(null);
  };

  const addStep = () => {
    const newId = `Step ${steps.length + 1}`;
    setSteps([...steps, { ...defaultStep, id: newId }]);
  };

  const removeStep = (index) => {
    if (steps.length > 1) {
      setSteps(steps.filter((_, i) => i !== index));
    }
  };

  const updateStep = (index, updatedStep) => {
    const newSteps = [...steps];
    newSteps[index] = updatedStep;
    setSteps(newSteps);
  };

  return (
    <div className="workflow-builder">
      <div className="workflow-sidebar">
        <div className="workflow-header">
          <h3>Workflow Configuration</h3>
          <div className="workflow-header-actions">
            <button
              className="saved-toggle-btn"
              onClick={() => setShowSaved(!showSaved)}
            >
              Saved ({savedWorkflows.length})
            </button>
            <button className="new-workflow-btn" onClick={handleNew}>
              New
            </button>
            {initialWorkflow && onCancelEdit && (
              <button className="cancel-edit-btn" onClick={onCancelEdit}>
                Cancel
              </button>
            )}
          </div>
        </div>

        {showSaved && (
          <div className="saved-workflows-panel">
            <h4>Saved Workflows</h4>
            {savedWorkflows.length === 0 ? (
              <p className="no-saved">No saved workflows yet</p>
            ) : (
              <div className="saved-list">
                {savedWorkflows.map((w) => (
                  <div
                    key={w.id}
                    className={`saved-item ${w.id === workflowId ? 'active' : ''}`}
                  >
                    <div className="saved-item-info" onClick={() => handleLoad(w)}>
                      <span className="saved-name">{w.name}</span>
                      <span className="saved-meta">
                        {w.steps?.length || 0} steps
                      </span>
                    </div>
                    <button
                      className="delete-saved-btn"
                      onClick={() => handleDelete(w.id)}
                    >
                      x
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="workflow-meta">
          <div className="form-group">
            <label>Workflow Name</label>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="My CLI Workflow"
            />
          </div>

          <div className="form-group">
            <label>Environment Variables</label>
            <textarea
              value={envVars}
              onChange={(e) => setEnvVars(e.target.value)}
              placeholder="KEY=value&#10;ANOTHER_KEY=another_value"
              rows={3}
            />
          </div>
        </div>

        <div className="steps-section">
          <div className="steps-header">
            <h4>Steps ({steps.length})</h4>
            <div className="steps-header-actions">
              <button
                className={`graph-toggle-btn ${showGraph ? 'active' : ''}`}
                onClick={() => setShowGraph(!showGraph)}
                title="Toggle graph view"
              >
                Graph
              </button>
              <button className="add-step-btn" onClick={addStep}>
                + Add Step
              </button>
            </div>
          </div>

          <div className={`steps-content ${showGraph ? 'with-graph' : ''}`}>
            <div className="steps-list">
              {steps.map((step, index) => (
                <StepConfig
                  key={index}
                  step={step}
                  index={index}
                  stepIds={steps.map((s) => s.id)}
                  onUpdate={(updated) => updateStep(index, updated)}
                  onRemove={() => removeStep(index)}
                  canRemove={steps.length > 1}
                />
              ))}
            </div>
            {showGraph && (
              <div className="steps-graph">
                <WorkflowGraph steps={steps} />
              </div>
            )}
          </div>
        </div>

        <div className="workflow-actions">
          <button
            className="save-workflow-btn"
            onClick={handleSave}
          >
            {workflowId ? 'Update' : 'Save'}
          </button>
        </div>
      </div>

      {error && <div className="workflow-error">{error}</div>}
    </div>
  );
}
