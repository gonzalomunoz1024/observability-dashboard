import { useState } from 'react';
import './StepConfig.css';

export function StepConfig({ step, index, stepIds, onUpdate, onRemove, canRemove }) {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleChange = (field, value) => {
    onUpdate({ ...step, [field]: value });
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

  const otherStepIds = stepIds.filter((id) => id !== step.id);
  const stepType = step.type || 'command';

  const getStepSummary = () => {
    if (stepType === 'http') {
      return step.http?.url ? <code>{step.http.method || 'GET'} {step.http.url}</code> : null;
    }
    return step.args ? <code>{step.args}</code> : null;
  };

  return (
    <div className={`step-config ${stepType === 'http' ? 'http-step' : ''}`}>
      <div className="step-header" onClick={() => setIsExpanded(!isExpanded)}>
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
            <div className="form-group">
              <label>Step ID</label>
              <input
                type="text"
                value={step.id}
                onChange={(e) => handleChange('id', e.target.value)}
                placeholder="Step 1"
              />
            </div>
            <div className="form-group">
              <label>Step Name</label>
              <input
                type="text"
                value={step.name}
                onChange={(e) => handleChange('name', e.target.value)}
                placeholder="Initialize App"
              />
            </div>
            <div className="form-group">
              <label>Step Type</label>
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

          {otherStepIds.length > 0 && (
            <div className="form-group">
              <label>Depends On (comma-separated step IDs)</label>
              <input
                type="text"
                value={step.dependsOn}
                onChange={(e) => handleChange('dependsOn', e.target.value)}
                placeholder={otherStepIds.join(', ')}
              />
            </div>
          )}

          {/* Command Type Fields */}
          {stepType === 'command' && (
            <>
              <div className="form-row">
                <div className="form-group flex-2">
                  <label>Arguments</label>
                  <input
                    type="text"
                    value={step.args}
                    onChange={(e) => handleChange('args', e.target.value)}
                    placeholder="init my-app --flag"
                  />
                  <span className="hint">Arguments passed to the executable at run time</span>
                </div>
                <div className="form-group flex-1">
                  <label>Timeout (ms)</label>
                  <input
                    type="number"
                    value={step.timeout}
                    onChange={(e) => handleChange('timeout', parseInt(e.target.value) || 30000)}
                  />
                </div>
              </div>

              <div className="section-divider">
                <span>Interactive Inputs (for prompts)</span>
              </div>

              <div className="form-row">
                <div className="form-group flex-3">
                  <label>Stdin Inputs (one per line)</label>
                  <textarea
                    value={step.stdinInputs}
                    onChange={(e) => handleChange('stdinInputs', e.target.value)}
                    placeholder="response-to-first-prompt&#10;response-to-second-prompt&#10;3"
                    rows={4}
                  />
                </div>
                <div className="form-group flex-1">
                  <label>Delay (ms)</label>
                  <input
                    type="number"
                    value={step.stdinDelay}
                    onChange={(e) => handleChange('stdinDelay', parseInt(e.target.value) || 100)}
                  />
                </div>
              </div>

              <div className="section-divider">
                <span>Expectations</span>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Exit Code</label>
                  <input
                    type="number"
                    value={step.expectations?.exitCode}
                    onChange={(e) => handleExpectationChange('exitCode', e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>Max Duration (ms)</label>
                  <input
                    type="number"
                    value={step.expectations?.maxDuration}
                    onChange={(e) => handleExpectationChange('maxDuration', e.target.value)}
                    placeholder="5000"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Stdout Contains (comma-separated)</label>
                <input
                  type="text"
                  value={step.expectations?.stdoutContains}
                  onChange={(e) => handleExpectationChange('stdoutContains', e.target.value)}
                  placeholder="success, completed"
                />
              </div>

              <div className="form-group">
                <label>Stdout Matches (regex)</label>
                <input
                  type="text"
                  value={step.expectations?.stdoutMatches}
                  onChange={(e) => handleExpectationChange('stdoutMatches', e.target.value)}
                  placeholder="Created directory: (.+)"
                />
              </div>

              <div className="form-group">
                <label>Stderr Contains (comma-separated)</label>
                <input
                  type="text"
                  value={step.expectations?.stderrContains}
                  onChange={(e) => handleExpectationChange('stderrContains', e.target.value)}
                  placeholder=""
                />
              </div>

              <div className="form-group checkbox-group">
                <label>
                  <input
                    type="checkbox"
                    checked={step.expectations?.stderrEmpty}
                    onChange={(e) => handleExpectationChange('stderrEmpty', e.target.checked)}
                  />
                  Expect stderr to be empty
                </label>
              </div>

              <div className="section-divider">
                <span>Variable Capture</span>
              </div>

              <div className="form-group">
                <label>Capture Variables (varName: regex per line)</label>
                <textarea
                  value={step.capture}
                  onChange={(e) => handleChange('capture', e.target.value)}
                  placeholder="workDir: Created directory: (.+)&#10;version: v(\d+\.\d+\.\d+)"
                  rows={3}
                />
              </div>

              <div className="section-divider">
                <span>Artifact Verification</span>
              </div>

              <div className="form-group">
                <label>Artifacts (path|contains|yaml/json per line)</label>
                <textarea
                  value={step.artifacts}
                  onChange={(e) => handleChange('artifacts', e.target.value)}
                  placeholder="{{workDir}}/catalog.yaml|apiVersion:|yaml&#10;{{workDir}}/spec.yaml|image:|yaml"
                  rows={3}
                />
                <span className="hint">Format: path | contains,strings | yaml or json</span>
              </div>
            </>
          )}

          {/* HTTP Type Fields */}
          {stepType === 'http' && (
            <>
              <div className="form-row">
                <div className="form-group" style={{ width: '120px', flex: 'none' }}>
                  <label>Method</label>
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
                  <label>URL *</label>
                  <input
                    type="text"
                    value={step.http?.url || ''}
                    onChange={(e) => handleHttpChange('url', e.target.value)}
                    placeholder="https://api.example.com/status/{{appId}}"
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Headers (JSON)</label>
                <textarea
                  value={step.http?.headers || ''}
                  onChange={(e) => handleHttpChange('headers', e.target.value)}
                  placeholder='{"Authorization": "Bearer {{token}}", "Content-Type": "application/json"}'
                  rows={2}
                />
              </div>

              {(step.http?.method === 'POST' || step.http?.method === 'PUT' || step.http?.method === 'PATCH') && (
                <div className="form-group">
                  <label>Request Body (JSON)</label>
                  <textarea
                    value={step.http?.body || ''}
                    onChange={(e) => handleHttpChange('body', e.target.value)}
                    placeholder='{"key": "value"}'
                    rows={4}
                  />
                </div>
              )}

              <div className="section-divider">
                <span>Polling Configuration</span>
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
                  Enable polling (retry until success)
                </label>
              </div>

              {step.http?.polling?.enabled && (
                <div className="form-row">
                  <div className="form-group">
                    <label>Poll Interval (seconds)</label>
                    <input
                      type="number"
                      value={step.http?.polling?.intervalSeconds || 30}
                      onChange={(e) => handleHttpChange('polling', {
                        ...step.http?.polling,
                        intervalSeconds: parseInt(e.target.value) || 30,
                      })}
                    />
                  </div>
                  <div className="form-group">
                    <label>Max Duration (minutes)</label>
                    <input
                      type="number"
                      value={step.http?.polling?.maxDurationMinutes || 60}
                      onChange={(e) => handleHttpChange('polling', {
                        ...step.http?.polling,
                        maxDurationMinutes: parseInt(e.target.value) || 60,
                      })}
                    />
                    <span className="hint">Will poll for up to this duration</span>
                  </div>
                </div>
              )}

              <div className="section-divider">
                <span>Expected Response</span>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>Expected Status Code</label>
                  <input
                    type="number"
                    value={step.http?.expect?.statusCode || 200}
                    onChange={(e) => handleHttpChange('expect', {
                      ...step.http?.expect,
                      statusCode: parseInt(e.target.value) || 200,
                    })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>Response Body Contains (comma-separated)</label>
                <input
                  type="text"
                  value={step.http?.expect?.bodyContains || ''}
                  onChange={(e) => handleHttpChange('expect', {
                    ...step.http?.expect,
                    bodyContains: e.target.value,
                  })}
                  placeholder="success, deployed, ready"
                />
              </div>

              <div className="form-group">
                <label>JSON Path Assertions (path=value per line)</label>
                <textarea
                  value={step.http?.expect?.jsonPath || ''}
                  onChange={(e) => handleHttpChange('expect', {
                    ...step.http?.expect,
                    jsonPath: e.target.value,
                  })}
                  placeholder="$.status=ready&#10;$.metadata.name={{appName}}"
                  rows={3}
                />
                <span className="hint">Use JSONPath expressions to validate response</span>
              </div>

              <div className="section-divider">
                <span>Variable Capture</span>
              </div>

              <div className="form-group">
                <label>Capture from Response (varName: jsonPath per line)</label>
                <textarea
                  value={step.http?.capture || ''}
                  onChange={(e) => handleHttpChange('capture', e.target.value)}
                  placeholder="deployId: $.deployment.id&#10;status: $.status"
                  rows={3}
                />
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
