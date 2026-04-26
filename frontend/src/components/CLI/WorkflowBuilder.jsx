import { useState, useEffect } from 'react';
import { StepConfig } from './StepConfig';
import { WorkflowGraph } from './WorkflowGraph';
import { SetupCommandsSection } from './SetupCommand';
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
    stderrEmpty: false,
    assertions: [],  // Array of {source: 'stdout'|'stderr', type: 'contains'|'regex', value}
  },
  capture: [],  // Array of {varName, source, regex}
  artifacts: [],  // Array of {varName, path, contains, yamlValid, jsonValid, isDirectory}
  http: {
    method: 'GET',
    url: '',
    headers: '',
    body: '',
    polling: { enabled: false, intervalSeconds: 30, maxDurationMinutes: 60 },
    expect: { statusCode: 200, bodyContains: '', jsonPath: '' },
    capture: [],  // Array of {varName, jsonPath}
  },
};

export function WorkflowBuilder({ onSave: onSaveCallback, onSaveComplete, initialWorkflow, onCancelEdit }) {
  const [workflowId, setWorkflowId] = useState(null);
  const [workflowName, setWorkflowName] = useState('');
  const [variables, setVariables] = useState([]); // Global variables with defaults
  const [envVars, setEnvVars] = useState('');
  const [setupCommands, setSetupCommands] = useState([]);
  const [steps, setSteps] = useState([{ ...defaultStep, id: 'Step 1' }]);
  const [error, setError] = useState(null);
  const [savedWorkflows, setSavedWorkflows] = useState([]);
  const [showSaved, setShowSaved] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [showVariables, setShowVariables] = useState(true);
  const [expandedStepIndex, setExpandedStepIndex] = useState(0);

  useEffect(() => {
    setSavedWorkflows(getSavedWorkflows());
  }, []);

  // Load initial workflow when provided (for editing)
  useEffect(() => {
    if (initialWorkflow) {
      setWorkflowId(initialWorkflow.id);
      setWorkflowName(initialWorkflow.name);
      setVariables(initialWorkflow.variables || []);
      setEnvVars(initialWorkflow.envVars || '');
      setSetupCommands(initialWorkflow.setupCommands || []);
      setSteps(initialWorkflow.steps || [{ ...defaultStep, id: 'Step 1' }]);
    }
  }, [initialWorkflow]);

  const handleSave = () => {
    if (!workflowName.trim()) {
      setError('Please enter a test name to save');
      return;
    }
    const saved = saveWorkflow({
      id: workflowId,
      name: workflowName,
      variables,
      envVars,
      setupCommands,
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
    setVariables(workflow.variables || []);
    setEnvVars(workflow.envVars || '');
    setSetupCommands(workflow.setupCommands || []);
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
    setVariables([]);
    setEnvVars('');
    setSetupCommands([]);
    setSteps([{ ...defaultStep, id: 'Step 1' }]);
    setError(null);
  };

  // Variable management functions
  const addVariable = () => {
    setVariables([...variables, { name: '', defaultValue: '', description: '' }]);
  };

  const updateVariable = (index, field, value) => {
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], [field]: value };
    setVariables(newVars);
  };

  const removeVariable = (index) => {
    setVariables(variables.filter((_, i) => i !== index));
  };

  const addStep = () => {
    const newId = `Step ${steps.length + 1}`;
    const newIndex = steps.length;
    setSteps([...steps, { ...defaultStep, id: newId }]);
    setExpandedStepIndex(newIndex); // Collapse all, expand new step
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
          <h3>Test Configuration</h3>
          <div className="workflow-header-actions">
            <button
              className="saved-toggle-btn"
              onClick={() => setShowSaved(!showSaved)}
            >
              Saved ({savedWorkflows.length})
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
            <label>Test Name</label>
            <input
              type="text"
              value={workflowName}
              onChange={(e) => setWorkflowName(e.target.value)}
              placeholder="My CLI Workflow"
            />
          </div>

          <div className="collapsible-section">
            <div
              className="collapsible-header"
              onClick={() => setShowVariables(!showVariables)}
            >
              <span className="collapse-icon">{showVariables ? '▼' : '▶'}</span>
              <span className="section-title">Variables ({variables.length})</span>
            </div>
            {showVariables && (
              <div className="collapsible-content">
                {variables.length === 0 ? (
                  <p className="empty-hint">No variables defined. Add variables to use as {'{{name}}'} in steps.</p>
                ) : (
                  <div className="variables-list">
                    {variables.map((v, index) => (
                      <div key={index} className="variable-row">
                        <input
                          type="text"
                          className="var-name"
                          value={v.name}
                          onChange={(e) => updateVariable(index, 'name', e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                          placeholder="name"
                        />
                        <input
                          type="text"
                          className="var-default"
                          value={v.defaultValue}
                          onChange={(e) => updateVariable(index, 'defaultValue', e.target.value)}
                          placeholder="default value"
                        />
                        <input
                          type="text"
                          className="var-desc"
                          value={v.description}
                          onChange={(e) => updateVariable(index, 'description', e.target.value)}
                          placeholder="description (optional)"
                        />
                        <button
                          className="remove-var-btn"
                          onClick={() => removeVariable(index)}
                          title="Remove variable"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <button className="add-var-btn" onClick={addVariable}>
                  + Add Variable
                </button>
                {variables.length > 0 && (
                  <p className="usage-hint">
                    Use as: {variables.filter(v => v.name).map(v => `{{${v.name}}}`).join(', ') || '{{variableName}}'}
                  </p>
                )}
              </div>
            )}
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

          <SetupCommandsSection
            commands={setupCommands}
            onChange={setSetupCommands}
          />
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
            </div>
          </div>

          <div className={`steps-content ${showGraph ? 'with-graph' : ''}`}>
            <div className="steps-list">
              {(() => {
                // Build varToStep map once for all steps
                const varToStep = {};
                steps.forEach(s => {
                  if (Array.isArray(s.capture)) {
                    s.capture.forEach(c => { if (c.varName) varToStep[c.varName] = s.id; });
                  }
                  if (Array.isArray(s.artifacts)) {
                    s.artifacts.forEach(a => { if (a.varName) varToStep[a.varName] = s.id; });
                  }
                  if (Array.isArray(s.http?.capture)) {
                    s.http.capture.forEach(c => { if (c.varName) varToStep[c.varName] = s.id; });
                  }
                });

                return steps.map((step, index) => {
                  // Compute available variables from global variables + previous steps
                  const availableVars = ['workDir']; // System variables
                  // Add global variables
                  variables.forEach(v => {
                    if (v.name) availableVars.push(v.name);
                  });
                  for (let i = 0; i < index; i++) {
                    const prevStep = steps[i];
                    if (Array.isArray(prevStep.capture)) {
                      prevStep.capture.forEach(item => {
                        if (item.varName) availableVars.push(item.varName);
                      });
                    }
                    if (Array.isArray(prevStep.artifacts)) {
                      prevStep.artifacts.forEach(item => {
                        if (item.varName) availableVars.push(item.varName);
                      });
                    }
                    if (Array.isArray(prevStep.http?.capture)) {
                      prevStep.http.capture.forEach(item => {
                        if (item.varName) availableVars.push(item.varName);
                      });
                    }
                  }
                  return (
                    <StepConfig
                      key={index}
                      step={step}
                      index={index}
                      previousStepIds={steps.slice(0, index).map((s) => s.id)}
                      availableVars={availableVars}
                      varToStep={varToStep}
                      isExpanded={expandedStepIndex === index}
                      onToggleExpand={() => setExpandedStepIndex(expandedStepIndex === index ? -1 : index)}
                      onUpdate={(updated) => updateStep(index, updated)}
                      onRemove={() => removeStep(index)}
                      canRemove={steps.length > 1}
                    />
                  );
                });
              })()}
              <button className="add-step-btn" onClick={addStep}>
                + Add Step
              </button>
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
