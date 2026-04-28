import { useState } from 'react';
import './StepConfig.css';

// Helper to ensure capture/artifacts are arrays (handles legacy string format)
const ensureArray = (value) => {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return []; // Legacy string format - start fresh
};

// Info tooltip component
const InfoTip = ({ text, example }) => {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [show, setShow] = useState(false);

  const handleMouseEnter = (e) => {
    const rect = e.target.getBoundingClientRect();
    setPos({
      x: Math.min(rect.left + 10, window.innerWidth - 280),
      y: rect.bottom + 8
    });
    setShow(true);
  };

  return (
    <span className="info-tip">
      <span
        className="info-tip-icon"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={() => setShow(false)}
      >
        i
      </span>
      {show && (
        <span
          className="info-tip-content"
          style={{ left: pos.x, top: pos.y }}
        >
          <span className="info-tip-text">
            {text}
            {example && <code className="info-tip-example">{example}</code>}
          </span>
        </span>
      )}
    </span>
  );
};

export function StepConfig({ step, index, previousStepIds = [], availableVars = [], varToStep = {}, isExpanded = true, onToggleExpand, onUpdate, onRemove, canRemove }) {
  const [showOutputsHelp, setShowOutputsHelp] = useState(false);
  const [showAssertionsHelp, setShowAssertionsHelp] = useState(false);

  // Find variables used in this step that come from previous steps
  const getUsedVariables = () => {
    const text = JSON.stringify(step);
    const matches = text.match(/\{\{(\w+)\}\}/g) || [];
    const vars = [...new Set(matches.map(m => m.slice(2, -2)))];
    return vars.filter(v => varToStep[v] && varToStep[v] !== step.id);
  };

  const usedVarsFromOtherSteps = getUsedVariables();

  const handleChange = (field, value) => {
    onUpdate({ ...step, [field]: value });
  };

  // Update multiple fields at once (for type switching)
  const handleMultiChange = (changes) => {
    onUpdate({ ...step, ...changes });
  };

  const handleExpectationChange = (field, value) => {
    onUpdate({
      ...step,
      expectations: { ...step.expectations, [field]: value },
    });
  };

  const handleHttpChange = (field, value) => {
    onUpdate({
      ...step,
      http: { ...step.http, [field]: value },
    });
  };

  const stepType = step.type || 'command';

  const getStepSummary = () => {
    if (stepType === 'http') {
      return step.http?.url ? <code>{step.http.method || 'GET'} {step.http.url}</code> : null;
    }
    return step.args ? <code>{step.args}</code> : null;
  };

  return (
    <div className={`step-config ${stepType === 'http' ? 'http-step' : ''}`}>
      <div className="step-header" onClick={onToggleExpand}>
        <span className="step-toggle">{isExpanded ? '▼' : '▶'}</span>
        <span className={`step-type-badge ${stepType}`}>
          {stepType === 'http' ? 'HTTP' : 'CMD'}
        </span>
        <span className="step-title">
          {step.name || step.id || `Step ${index + 1}`}
        </span>
        <span className="step-summary">
          {getStepSummary()}
        </span>
        {usedVarsFromOtherSteps.length > 0 && (
          <span className="step-deps" title={`Uses: ${usedVarsFromOtherSteps.map(v => `{{${v}}}`).join(', ')}`}>
            <span className="dep-icon">↳</span>
            {usedVarsFromOtherSteps.map(v => varToStep[v]).filter((v, i, arr) => arr.indexOf(v) === i).join(', ')}
          </span>
        )}
        {canRemove && (
          <button
            className="remove-step-btn"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            ×
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="step-body">
          <div className="form-row">
            <div className="form-group flex-2">
              <label>
                Step Name
                <InfoTip text="A descriptive name for this step" example="Initialize Project" />
              </label>
              <input
                type="text"
                value={step.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Initialize App"
              />
            </div>
            <div className="form-group flex-1">
              <label>
                Step Type
                <InfoTip text="Command runs CLI commands. HTTP makes API requests." />
              </label>
              <select
                value={stepType}
                onChange={(e) => handleChange('type', e.target.value)}
                className="step-type-select"
              >
                <option value="command">Command</option>
                <option value="http">HTTP Request</option>
              </select>
            </div>
          </div>

          {/* Command Type Fields */}
          {stepType === 'command' && (
            <>
              {availableVars.length > 0 && (
                <div className="available-vars">
                  <span className="available-vars-label">Available variables:</span>
                  <div className="available-vars-list">
                    {availableVars.map(v => (
                      <code
                        key={v}
                        className={`var-chip ${v === 'workDir' ? 'system' : ''}`}
                        title={v === 'workDir' ? 'Workflow temp directory' : 'Captured from previous step'}
                      >
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group flex-2">
                  <label>
                    Arguments
                    <InfoTip text="Command-line arguments passed to the CLI. Use {{varName}} for variables." example="init my-app --template react" />
                  </label>
                  <input
                    type="text"
                    value={step.args}
                    onChange={(e) => handleChange('args', e.target.value)}
                    placeholder={availableVars.length > 1 ? `build {{${availableVars[1] || 'folderName'}}}` : "init my-app --flag"}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>
                    Timeout (ms)
                    <InfoTip text="Max time to wait for command to complete" example="30000 (30 seconds)" />
                  </label>
                  <input
                    type="number"
                    value={step.timeout ?? ''}
                    onChange={(e) => handleChange('timeout', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    onBlur={(e) => e.target.value === '' && handleChange('timeout', 30000)}
                    placeholder="30000"
                  />
                </div>
              </div>

              <div className="section-divider">
                <span>Interactive Inputs</span>
              </div>

              <div className="form-row">
                <div className="form-group flex-3">
                  <label>
                    Stdin Inputs
                    <InfoTip text="One response per line. Sent in order when CLI waits for input." example="my-project\nyes\n3" />
                  </label>
                  <textarea
                    value={step.stdinInputs}
                    onChange={(e) => handleChange('stdinInputs', e.target.value)}
                    placeholder="response-to-first-prompt&#10;response-to-second-prompt&#10;3"
                    rows={4}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>
                    Delay (ms)
                    <InfoTip text="Wait time between each input" example="100" />
                  </label>
                  <input
                    type="number"
                    value={step.stdinDelay ?? ''}
                    onChange={(e) => handleChange('stdinDelay', e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                    onBlur={(e) => e.target.value === '' && handleChange('stdinDelay', 100)}
                    placeholder="100"
                  />
                </div>
              </div>

              <div className="section-divider">
                <span>Expectations</span>
              </div>

              <div className="form-group" style={{ width: '120px', flex: 'none' }}>
                <label>
                  Exit Code
                  <InfoTip text="Expected process exit code. 0 = success." example="0" />
                </label>
                <input
                  type="number"
                  value={step.expectations?.exitCode}
                  onChange={(e) => handleExpectationChange('exitCode', e.target.value)}
                />
              </div>

              <div className="section-divider">
                <span>Assertions</span>
                <button
                  type="button"
                  className="info-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowAssertionsHelp(true);
                  }}
                  title="Learn about assertion types"
                >
                  i
                </button>
              </div>

              {showAssertionsHelp && (
                <div className="help-modal-overlay" onClick={() => setShowAssertionsHelp(false)}>
                  <div className="help-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="help-modal-header">
                      <h3>Assertion Types</h3>
                      <button className="help-modal-close" onClick={() => setShowAssertionsHelp(false)}>×</button>
                    </div>
                    <div className="help-modal-body">
                      <div className="help-section">
                        <h4>Contains</h4>
                        <p>Check if the output includes specific text. Add multiple assertions to check for multiple strings.</p>
                        <div className="help-example">
                          <strong>Example:</strong>
                          <code>Source: stdout</code>
                          <code>Value: success</code>
                          <p>Passes if stdout contains "success"</p>
                        </div>
                      </div>
                      <div className="help-section">
                        <h4>Regex</h4>
                        <p>Check if the output matches a regular expression pattern. Useful for dynamic content or complex patterns.</p>
                        <div className="help-example">
                          <strong>Example:</strong>
                          <code>Source: stdout</code>
                          <code>Value: Created project: [a-z0-9-]+</code>
                          <p>Passes if stdout contains "Created project:" followed by a valid project name</p>
                        </div>
                      </div>
                      <div className="help-tip">
                        <strong>Tip:</strong> Use <code>stdout</code> for normal output and <code>stderr</code> for error messages or warnings.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="kv-editor">
                {ensureArray(step.expectations?.assertions).map((assertion, i) => (
                  <div key={`assertion-${i}`} className="output-card">
                    <div className="output-type-row">
                      <label className={`output-type ${assertion.source === 'stdout' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          checked={assertion.source === 'stdout'}
                          onChange={() => {
                            const newAssertions = [...ensureArray(step.expectations?.assertions)];
                            newAssertions[i] = { ...newAssertions[i], source: 'stdout' };
                            handleExpectationChange('assertions', newAssertions);
                          }}
                        />
                        stdout
                      </label>
                      <label className={`output-type ${assertion.source === 'stderr' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          checked={assertion.source === 'stderr'}
                          onChange={() => {
                            const newAssertions = [...ensureArray(step.expectations?.assertions)];
                            newAssertions[i] = { ...newAssertions[i], source: 'stderr' };
                            handleExpectationChange('assertions', newAssertions);
                          }}
                        />
                        stderr
                      </label>
                      <span className="output-type-spacer" />
                      <label className={`output-type ${assertion.type === 'contains' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          checked={assertion.type === 'contains'}
                          onChange={() => {
                            const newAssertions = [...ensureArray(step.expectations?.assertions)];
                            newAssertions[i] = { ...newAssertions[i], type: 'contains' };
                            handleExpectationChange('assertions', newAssertions);
                          }}
                        />
                        Contains
                      </label>
                      <label className={`output-type ${assertion.type === 'regex' ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          checked={assertion.type === 'regex'}
                          onChange={() => {
                            const newAssertions = [...ensureArray(step.expectations?.assertions)];
                            newAssertions[i] = { ...newAssertions[i], type: 'regex' };
                            handleExpectationChange('assertions', newAssertions);
                          }}
                        />
                        Regex
                      </label>
                      <button
                        type="button"
                        className="output-remove"
                        onClick={() => {
                          const newAssertions = ensureArray(step.expectations?.assertions).filter((_, idx) => idx !== i);
                          handleExpectationChange('assertions', newAssertions);
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <div className="output-fields">
                      <div className="output-field" style={{ flex: 1 }}>
                        <label>{assertion.type === 'regex' ? 'Pattern' : 'Value'}</label>
                        <input
                          type="text"
                          value={assertion.value || ''}
                          onChange={(e) => {
                            const newAssertions = [...ensureArray(step.expectations?.assertions)];
                            newAssertions[i] = { ...newAssertions[i], value: e.target.value };
                            handleExpectationChange('assertions', newAssertions);
                          }}
                          placeholder={assertion.type === 'regex' ? 'Created project: [a-z0-9-]+' : 'success'}
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="kv-add"
                  onClick={() => {
                    const newAssertions = [...ensureArray(step.expectations?.assertions), { source: 'stdout', type: 'contains', value: '' }];
                    handleExpectationChange('assertions', newAssertions);
                  }}
                >
                  + Add Assertion
                </button>
              </div>

              <div className="form-group checkbox-group" style={{ marginTop: 'var(--space-3)' }}>
                <label>
                  <input
                    type="checkbox"
                    checked={step.expectations?.stderrEmpty}
                    onChange={(e) => handleExpectationChange('stderrEmpty', e.target.checked)}
                  />
                  Expect stderr to be empty
                  <InfoTip text="Fail if any error output is produced" />
                </label>
              </div>

              <div className="section-divider">
                <span>Outputs</span>
                <button
                  type="button"
                  className="info-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowOutputsHelp(true);
                  }}
                  title="Learn about output types"
                >
                  i
                </button>
              </div>

              {showOutputsHelp && (
                <div className="help-modal-overlay" onClick={() => setShowOutputsHelp(false)}>
                  <div className="help-modal" onClick={(e) => e.stopPropagation()}>
                    <div className="help-modal-header">
                      <h3>Output Types</h3>
                      <button className="help-modal-close" onClick={() => setShowOutputsHelp(false)}>×</button>
                    </div>
                    <div className="help-modal-body">
                      <div className="help-section">
                        <h4>Variable</h4>
                        <p>Capture text from command output using a regex pattern. The captured value becomes available as a variable in subsequent steps.</p>
                        <div className="help-example">
                          <strong>Example:</strong>
                          <code>Variable Name: projectId</code>
                          <code>Regex: Created project: (\S+)</code>
                          <p>If stdout contains "Created project: my-app-123", then <code>{`{{projectId}}`}</code> = "my-app-123"</p>
                        </div>
                      </div>
                      <div className="help-section">
                        <h4>File</h4>
                        <p>Verify that a file exists after the step runs. Optionally validate it as YAML or JSON. The resolved path becomes available as a variable.</p>
                        <div className="help-example">
                          <strong>Example:</strong>
                          <code>Variable Name: configFile</code>
                          <code>Path: ./config/settings.yaml</code>
                          <p>Verifies the file exists. Use <code>{`{{configFile}}`}</code> in later steps to reference the full path.</p>
                        </div>
                      </div>
                      <div className="help-section">
                        <h4>Directory</h4>
                        <p>Verify that a directory was created. The resolved path becomes available as a variable for use in subsequent steps.</p>
                        <div className="help-example">
                          <strong>Example:</strong>
                          <code>Variable Name: outputDir</code>
                          <code>Path: ./build/output</code>
                          <p>Verifies the directory exists. Use <code>{`{{outputDir}}`}</code> to reference it later.</p>
                        </div>
                      </div>
                      <div className="help-tip">
                        <strong>Tip:</strong> Paths starting with <code>./</code> or relative paths are automatically resolved relative to the workflow's working directory.
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="kv-editor">
                {/* Variable captures */}
                {ensureArray(step.capture).map((item, i) => (
                  <div key={`cap-${i}`} className="output-card">
                    <div className="output-type-row">
                      <label className="output-type selected">
                        <input type="radio" checked readOnly />
                        Variable
                      </label>
                      <label className="output-type">
                        <input
                          type="radio"
                          checked={false}
                          onChange={() => {
                            // Convert to file artifact
                            const newCapture = ensureArray(step.capture).filter((_, idx) => idx !== i);
                            const newArtifacts = [...ensureArray(step.artifacts), { varName: item.varName, path: '', isDirectory: false }];
                            handleMultiChange({ capture: newCapture, artifacts: newArtifacts });
                          }}
                        />
                        File
                      </label>
                      <label className="output-type">
                        <input
                          type="radio"
                          checked={false}
                          onChange={() => {
                            // Convert to directory artifact
                            const newCapture = ensureArray(step.capture).filter((_, idx) => idx !== i);
                            const newArtifacts = [...ensureArray(step.artifacts), { varName: item.varName, path: '', isDirectory: true }];
                            handleMultiChange({ capture: newCapture, artifacts: newArtifacts });
                          }}
                        />
                        Directory
                      </label>
                      <button
                        type="button"
                        className="output-remove"
                        onClick={() => {
                          const newCapture = ensureArray(step.capture).filter((_, idx) => idx !== i);
                          handleChange('capture', newCapture);
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <div className="output-fields">
                      <div className="output-field">
                        <label>Variable Name</label>
                        <input
                          type="text"
                          value={item.varName || ''}
                          onChange={(e) => {
                            const newCapture = [...ensureArray(step.capture)];
                            newCapture[i] = { ...newCapture[i], varName: e.target.value };
                            handleChange('capture', newCapture);
                          }}
                          placeholder="folderName"
                        />
                      </div>
                      <div className="output-field flex-2">
                        <label>Regex Pattern</label>
                        <input
                          type="text"
                          value={item.regex || ''}
                          onChange={(e) => {
                            const newCapture = [...ensureArray(step.capture)];
                            newCapture[i] = { ...newCapture[i], regex: e.target.value };
                            handleChange('capture', newCapture);
                          }}
                          placeholder="test_suite_(\S+)"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                {/* File/Directory artifacts */}
                {ensureArray(step.artifacts).map((item, i) => (
                  <div key={`art-${i}`} className="output-card">
                    <div className="output-type-row">
                      <label className="output-type">
                        <input
                          type="radio"
                          checked={false}
                          onChange={() => {
                            // Convert to variable capture
                            const newArtifacts = ensureArray(step.artifacts).filter((_, idx) => idx !== i);
                            const newCapture = [...ensureArray(step.capture), { varName: item.varName, regex: '' }];
                            handleMultiChange({ capture: newCapture, artifacts: newArtifacts });
                          }}
                        />
                        Variable
                      </label>
                      <label className={`output-type ${!item.isDirectory ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          checked={!item.isDirectory}
                          onChange={() => {
                            const newArtifacts = [...ensureArray(step.artifacts)];
                            newArtifacts[i] = { ...newArtifacts[i], isDirectory: false };
                            handleChange('artifacts', newArtifacts);
                          }}
                        />
                        File
                      </label>
                      <label className={`output-type ${item.isDirectory ? 'selected' : ''}`}>
                        <input
                          type="radio"
                          checked={item.isDirectory || false}
                          onChange={() => {
                            const newArtifacts = [...ensureArray(step.artifacts)];
                            newArtifacts[i] = { ...newArtifacts[i], isDirectory: true, yamlValid: false, jsonValid: false };
                            handleChange('artifacts', newArtifacts);
                          }}
                        />
                        Directory
                      </label>
                      <button
                        type="button"
                        className="output-remove"
                        onClick={() => {
                          const newArtifacts = ensureArray(step.artifacts).filter((_, idx) => idx !== i);
                          handleChange('artifacts', newArtifacts);
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <div className="output-fields">
                      <div className="output-field">
                        <label>Variable Name</label>
                        <input
                          type="text"
                          value={item.varName || ''}
                          onChange={(e) => {
                            const newArtifacts = [...ensureArray(step.artifacts)];
                            newArtifacts[i] = { ...newArtifacts[i], varName: e.target.value };
                            handleChange('artifacts', newArtifacts);
                          }}
                          placeholder="projectDir"
                        />
                      </div>
                      <div className="output-field flex-2">
                        <label>Path</label>
                        <input
                          type="text"
                          value={item.path || ''}
                          onChange={(e) => {
                            const newArtifacts = [...ensureArray(step.artifacts)];
                            newArtifacts[i] = { ...newArtifacts[i], path: e.target.value };
                            handleChange('artifacts', newArtifacts);
                          }}
                          placeholder="./test_suite_001"
                        />
                      </div>
                    </div>
                    {!item.isDirectory && (
                      <div className="output-extra">
                        <label className="output-checkbox">
                          <input
                            type="checkbox"
                            checked={item.yamlValid || false}
                            onChange={(e) => {
                              const newArtifacts = [...ensureArray(step.artifacts)];
                              newArtifacts[i] = { ...newArtifacts[i], yamlValid: e.target.checked };
                              handleChange('artifacts', newArtifacts);
                            }}
                          />
                          Validate YAML
                        </label>
                        <label className="output-checkbox">
                          <input
                            type="checkbox"
                            checked={item.jsonValid || false}
                            onChange={(e) => {
                              const newArtifacts = [...ensureArray(step.artifacts)];
                              newArtifacts[i] = { ...newArtifacts[i], jsonValid: e.target.checked };
                              handleChange('artifacts', newArtifacts);
                            }}
                          />
                          Validate JSON
                        </label>
                      </div>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  className="kv-add"
                  onClick={() => handleChange('artifacts', [...ensureArray(step.artifacts), { varName: '', path: '', isDirectory: true }])}
                >
                  + Add Output
                </button>
              </div>
            </>
          )}

          {/* HTTP Type Fields */}
          {stepType === 'http' && (
            <>
              {availableVars.length > 0 && (
                <div className="available-vars">
                  <span className="available-vars-label">Available variables:</span>
                  <div className="available-vars-list">
                    {availableVars.map(v => (
                      <code
                        key={v}
                        className={`var-chip ${v === 'workDir' ? 'system' : ''}`}
                        title={v === 'workDir' ? 'Workflow temp directory' : 'Captured from previous step'}
                      >
                        {`{{${v}}}`}
                      </code>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-row">
                <div className="form-group" style={{ width: '120px', flex: 'none' }}>
                  <label>
                    Method
                    <InfoTip text="HTTP request method" />
                  </label>
                  <select
                    value={step.http?.method || 'GET'}
                    onChange={(e) => handleHttpChange('method', e.target.value)}
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                    <option value="PUT">PUT</option>
                    <option value="DELETE">DELETE</option>
                    <option value="PATCH">PATCH</option>
                  </select>
                </div>
                <div className="form-group flex-1">
                  <label>
                    URL
                    <InfoTip text="Full URL to request. Use {{var}} for variables." example="https://api.example.com/v1/{{appId}}/status" />
                  </label>
                  <input
                    type="text"
                    value={step.http?.url || ''}
                    onChange={(e) => handleHttpChange('url', e.target.value)}
                    placeholder="https://api.example.com/status/{{appId}}"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>
                  Headers
                  <InfoTip text="Request headers as JSON object" example='{"Authorization": "Bearer {{token}}"}' />
                </label>
                <textarea
                  value={step.http?.headers || ''}
                  onChange={(e) => handleHttpChange('headers', e.target.value)}
                  placeholder='{"Authorization": "Bearer {{token}}", "Content-Type": "application/json"}'
                  rows={2}
                />
              </div>

              {(step.http?.method === 'POST' || step.http?.method === 'PUT' || step.http?.method === 'PATCH') && (
                <div className="form-group">
                  <label>
                    Request Body
                    <InfoTip text="JSON body to send with the request" example='{"name": "{{projectName}}"}' />
                  </label>
                  <textarea
                    value={step.http?.body || ''}
                    onChange={(e) => handleHttpChange('body', e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={4}
                  />
                </div>
              )}

              <div className="section-divider">
                <span>Polling</span>
                <InfoTip text="Retry the request until it succeeds or times out" />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={step.http?.polling?.enabled || false}
                    onChange={(e) => handleHttpChange('polling', {
                      ...step.http?.polling,
                      enabled: e.target.checked,
                    })}
                  />
                  Enable polling
                  <InfoTip text="Keep retrying until expected response is received" />
                </label>
              </div>

              {step.http?.polling?.enabled && (
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      Interval (seconds)
                      <InfoTip text="Time between retries" example="30" />
                    </label>
                    <input
                      type="number"
                      value={step.http?.polling?.intervalSeconds ?? ''}
                      onChange={(e) => handleHttpChange('polling', {
                        ...step.http?.polling,
                        intervalSeconds: e.target.value === '' ? '' : parseInt(e.target.value, 10),
                      })}
                      onBlur={(e) => e.target.value === '' && handleHttpChange('polling', {
                        ...step.http?.polling,
                        intervalSeconds: 30,
                      })}
                      placeholder="30"
                    />
                  </div>
                  <div className="form-group">
                    <label>
                      Max Duration (minutes)
                      <InfoTip text="Stop polling after this time" example="60" />
                    </label>
                    <input
                      type="number"
                      value={step.http?.polling?.maxDurationMinutes ?? ''}
                      onChange={(e) => handleHttpChange('polling', {
                        ...step.http?.polling,
                        maxDurationMinutes: e.target.value === '' ? '' : parseInt(e.target.value, 10),
                      })}
                      onBlur={(e) => e.target.value === '' && handleHttpChange('polling', {
                        ...step.http?.polling,
                        maxDurationMinutes: 60,
                      })}
                      placeholder="60"
                    />
                  </div>
                </div>
              )}

              <div className="section-divider">
                <span>Expected Response</span>
                <InfoTip text="Conditions the response must meet" />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>
                    Status Code
                    <InfoTip text="Expected HTTP status code" example="200" />
                  </label>
                  <input
                    type="number"
                    value={step.http?.expect?.statusCode ?? ''}
                    onChange={(e) => handleHttpChange('expect', {
                      ...step.http?.expect,
                      statusCode: e.target.value === '' ? '' : parseInt(e.target.value, 10),
                    })}
                    onBlur={(e) => e.target.value === '' && handleHttpChange('expect', {
                      ...step.http?.expect,
                      statusCode: 200,
                    })}
                    placeholder="200"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group" style={{ flex: 1 }}>
                  <label>
                    Body Contains
                    <InfoTip text="Text that must appear in response body" example="success" />
                  </label>
                  <input
                    type="text"
                    value={step.http?.expect?.bodyContains || ''}
                    onChange={(e) => handleHttpChange('expect', {
                      ...step.http?.expect,
                      bodyContains: e.target.value,
                    })}
                    placeholder="success, deployed"
                  />
                </div>
                <div className="form-group" style={{ flex: 1 }}>
                  <label>
                    JSON Path Check
                    <InfoTip text="Validate a JSON value" example="$.status=ready" />
                  </label>
                  <input
                    type="text"
                    value={step.http?.expect?.jsonPath || ''}
                    onChange={(e) => handleHttpChange('expect', {
                      ...step.http?.expect,
                      jsonPath: e.target.value,
                    })}
                    placeholder="$.status=ready"
                  />
                </div>
              </div>

              <div className="section-divider">
                <span>Outputs</span>
                <InfoTip text="Extract values from response to use in later steps" />
              </div>

              <div className="kv-editor">
                {ensureArray(step.http?.capture).map((item, i) => (
                  <div key={`http-cap-${i}`} className="output-card">
                    <div className="output-type-row">
                      <span className="output-type-label">Variable</span>
                      <button
                        type="button"
                        className="output-remove"
                        onClick={() => {
                          const newCapture = ensureArray(step.http?.capture).filter((_, idx) => idx !== i);
                          handleHttpChange('capture', newCapture);
                        }}
                      >
                        ×
                      </button>
                    </div>
                    <div className="output-fields">
                      <div className="output-field">
                        <label>Variable Name</label>
                        <input
                          type="text"
                          value={item.varName || ''}
                          onChange={(e) => {
                            const newCapture = [...ensureArray(step.http?.capture)];
                            newCapture[i] = { ...newCapture[i], varName: e.target.value };
                            handleHttpChange('capture', newCapture);
                          }}
                          placeholder="appId"
                        />
                      </div>
                      <div className="output-field flex-2">
                        <label>JSON Path</label>
                        <input
                          type="text"
                          value={item.jsonPath || ''}
                          onChange={(e) => {
                            const newCapture = [...ensureArray(step.http?.capture)];
                            newCapture[i] = { ...newCapture[i], jsonPath: e.target.value };
                            handleHttpChange('capture', newCapture);
                          }}
                          placeholder="$.deployment.id"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="kv-add"
                  onClick={() => {
                    const newCapture = [...ensureArray(step.http?.capture), { varName: '', jsonPath: '' }];
                    handleHttpChange('capture', newCapture);
                  }}
                >
                  + Add Output
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
