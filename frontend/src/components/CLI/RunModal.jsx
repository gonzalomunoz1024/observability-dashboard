import { useState, useRef } from 'react';
import { uploadExecutable, runWorkflowWithProgress } from '../../utils/cli';
import { formatWorkflowForExecution } from '../../utils/workflowFormatter';
import { cleanCliOutput } from '../../utils/outputCleaner';
import './RunModal.css';

export function RunModal({ tests = [], onClose, onResult }) {
  const [executableFile, setExecutableFile] = useState(null);
  const [executableName, setExecutableName] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  // Configurations for parallel runs with different variable values
  const [configurations, setConfigurations] = useState([]);
  const [expandedConfigs, setExpandedConfigs] = useState({});

  // Progress tracking per configuration
  const [configProgress, setConfigProgress] = useState({}); // { configId: { stepProgress: {}, stepResults: {}, status: 'pending'|'running'|'passed'|'failed' } }
  const [completedConfigs, setCompletedConfigs] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');

  const testNames = tests.map(t => t.name);

  // Get all workflow variables from the first test (they should be the same)
  const workflowVariables = tests[0]?.variables || [];
  const hasVariables = workflowVariables.length > 0;

  // Initialize configurations when modal opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initConfigs = () => {
    if (configurations.length === 0 && tests.length > 0) {
      const configId = `config-${Date.now()}`;
      const defaultVars = {};
      workflowVariables.forEach(v => {
        if (v.name) defaultVars[v.name] = v.defaultValue || '';
      });
      setConfigurations([{
        id: configId,
        name: 'Run 1',
        variables: defaultVars,
        expanded: true
      }]);
      setExpandedConfigs({ [configId]: true });
    }
  };

  // Run initialization on mount
  if (configurations.length === 0 && tests.length > 0 && !isRunning) {
    initConfigs();
  }

  // Configuration management
  const addConfiguration = (cloneFrom = null) => {
    const newId = `config-${Date.now()}`;
    let newVars = {};

    if (cloneFrom) {
      const sourceConfig = configurations.find(c => c.id === cloneFrom);
      newVars = { ...sourceConfig?.variables };
    } else {
      workflowVariables.forEach(v => {
        if (v.name) newVars[v.name] = v.defaultValue || '';
      });
    }

    setConfigurations([...configurations, {
      id: newId,
      name: `Run ${configurations.length + 1}`,
      variables: newVars
    }]);
    setExpandedConfigs(prev => ({ ...prev, [newId]: true }));
  };

  const removeConfiguration = (configId) => {
    if (configurations.length > 1) {
      setConfigurations(configurations.filter(c => c.id !== configId));
    }
  };

  const updateConfigName = (configId, name) => {
    setConfigurations(configurations.map(c =>
      c.id === configId ? { ...c, name } : c
    ));
  };

  const updateConfigVariable = (configId, varName, value) => {
    setConfigurations(configurations.map(c =>
      c.id === configId ? { ...c, variables: { ...c.variables, [varName]: value } } : c
    ));
  };

  const toggleConfigExpand = (configId) => {
    setExpandedConfigs(prev => ({ ...prev, [configId]: !prev[configId] }));
  };

  // Helper functions for formatting output (similar to CLIResults)
  const formatJsonOutput = (output) => {
    if (!output) return null;
    try {
      const parsed = JSON.parse(output);
      const pretty = JSON.stringify(parsed, null, 2);
      const lines = pretty.split('\n');
      return {
        formatted: lines.map((line, i) => `${String(i + 1).padStart(3, ' ')} │ ${line}`).join('\n'),
        lineCount: lines.length,
        isJson: true
      };
    } catch {
      return { formatted: output, lineCount: output.split('\n').length, isJson: false };
    }
  };

  const getFailureReason = (result) => {
    if (!result?.validation?.validations && !result?.validations) return result?.error || 'Unknown error';
    const validations = result?.validation?.validations || result?.validations || [];
    const failed = validations.filter(v => !v.passed);
    if (failed.length === 0) return result?.error || 'Unknown error';
    return failed.map(v => {
      if (v.type === 'exitCode') return `Exit code: expected ${v.expected}, got ${v.actual}`;
      if (v.type === 'stdoutContains') return `Missing in output: "${v.expected}"`;
      if (v.type === 'stderrEmpty') return 'Stderr was not empty';
      if (v.type === 'maxDuration') return `Took ${v.actual}ms (max: ${v.expected}ms)`;
      if (v.type === 'statusCode') return `Status: expected ${v.expected}, got ${v.actual}`;
      return v.type;
    }).join(', ');
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setExecutableFile(file);
      setExecutableName(file.name);
    }
  };

  const clearExecutable = () => {
    setExecutableFile(null);
    setExecutableName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Run a single configuration
  const runConfiguration = async (config, test, executablePath) => {
    const configId = config.id;

    // Initialize progress for this config
    const initialStepProgress = {};
    test.steps.forEach((step, idx) => {
      initialStepProgress[step.id] = idx === 0 ? 'running' : 'pending';
    });

    setConfigProgress(prev => ({
      ...prev,
      [configId]: {
        status: 'running',
        stepProgress: initialStepProgress,
        stepResults: {},
        expandedSteps: {}
      }
    }));

    try {
      // Format workflow with this config's variables
      const formatted = formatWorkflowForExecution(test, executablePath, config.variables);
      console.log(`Running config ${config.name}:`, formatted);

      const result = await runWorkflowWithProgress(
        formatted,
        (stepId) => {
          setConfigProgress(prev => ({
            ...prev,
            [configId]: {
              ...prev[configId],
              stepProgress: { ...prev[configId]?.stepProgress, [stepId]: 'running' }
            }
          }));
        },
        (stepId, stepResult) => {
          const passed = stepResult?.passed;
          setConfigProgress(prev => ({
            ...prev,
            [configId]: {
              ...prev[configId],
              stepProgress: { ...prev[configId]?.stepProgress, [stepId]: passed ? 'passed' : 'failed' },
              stepResults: { ...prev[configId]?.stepResults, [stepId]: stepResult },
              expandedSteps: !passed ? { ...prev[configId]?.expandedSteps, [stepId]: true } : prev[configId]?.expandedSteps
            }
          }));
        },
        (stepId, error) => {
          setConfigProgress(prev => ({
            ...prev,
            [configId]: {
              ...prev[configId],
              stepProgress: { ...prev[configId]?.stepProgress, [stepId]: 'failed' },
              stepResults: { ...prev[configId]?.stepResults, [stepId]: { passed: false, error } },
              expandedSteps: { ...prev[configId]?.expandedSteps, [stepId]: true }
            }
          }));
        }
      );

      const resultSteps = result?.steps || result?.results || [];
      const allPassed = result?.passed ?? resultSteps.every(s => s.passed);

      // Update final step results
      const finalStepProgress = {};
      const finalStepResults = {};
      resultSteps.forEach(stepResult => {
        const passed = stepResult.passed ?? (stepResult.validation?.passed ?? false);
        finalStepProgress[stepResult.id] = passed ? 'passed' : 'failed';
        finalStepResults[stepResult.id] = stepResult;
      });

      setConfigProgress(prev => ({
        ...prev,
        [configId]: {
          ...prev[configId],
          status: allPassed ? 'passed' : 'failed',
          stepProgress: { ...prev[configId]?.stepProgress, ...finalStepProgress },
          stepResults: { ...prev[configId]?.stepResults, ...finalStepResults },
          result
        }
      }));

      // Pass result back to parent for Execution History
      if (onResult) {
        onResult(test, result, executablePath, config);
      }

      return { config, result, passed: allPassed };
    } catch (err) {
      setConfigProgress(prev => ({
        ...prev,
        [configId]: {
          ...prev[configId],
          status: 'failed',
          error: err.message
        }
      }));
      return { config, error: err.message, passed: false };
    }
  };

  const handleRun = async () => {
    if (!executableFile) {
      setError('Please upload an executable');
      return;
    }

    // Ensure we have at least one configuration
    let configsToRun = configurations;
    if (configsToRun.length === 0) {
      const defaultVars = {};
      workflowVariables.forEach(v => {
        if (v.name) defaultVars[v.name] = v.defaultValue || '';
      });
      configsToRun = [{
        id: `config-${Date.now()}`,
        name: 'Run 1',
        variables: defaultVars
      }];
      setConfigurations(configsToRun);
    }

    setIsRunning(true);
    setError(null);
    setCompletedConfigs([]);
    setConfigProgress({});
    setStatusMessage('Uploading executable...');

    try {
      const uploadResult = await uploadExecutable(executableFile);
      setStatusMessage(`Running ${configsToRun.length} configuration${configsToRun.length > 1 ? 's' : ''}...`);

      // Run all configurations in parallel for each test
      const test = tests[0]; // For now, assume single test with multiple configs

      // Execute all configurations in parallel
      const results = await Promise.all(
        configsToRun.map(config => runConfiguration(config, test, uploadResult.path))
      );

      setCompletedConfigs(results);
      setStatusMessage('Complete');
    } catch (err) {
      setError(err.message);
      setStatusMessage('Error');
    }
  };

  const getStepIcon = (status) => {
    switch (status) {
      case 'running':
        return <span className="step-icon running">&#9676;</span>;
      case 'passed':
        return <span className="step-icon passed">&#10003;</span>;
      case 'failed':
        return <span className="step-icon failed">&#10007;</span>;
      default:
        return <span className="step-icon pending">&#9675;</span>;
    }
  };

  const handleClose = () => {
    // Allow closing if not actively running, or if complete/error
    if (!isRunning || statusMessage === 'Complete' || statusMessage === 'Error') {
      onClose();
    }
  };

  const isFinished = statusMessage === 'Complete' || statusMessage === 'Error';

  // Get current test for display
  const currentTest = tests[0];
  const currentSteps = currentTest?.steps || [];

  // Toggle step expand within a specific config
  const toggleConfigStepExpand = (configId, stepId) => {
    setConfigProgress(prev => ({
      ...prev,
      [configId]: {
        ...prev[configId],
        expandedSteps: {
          ...prev[configId]?.expandedSteps,
          [stepId]: !prev[configId]?.expandedSteps?.[stepId]
        }
      }
    }));
  };

  // Render step details (matching CLIResults format exactly)
  const renderStepDetails = (step, result) => {
    if (!result) return null;

    // Debug: log the actual result structure to see where stdout is
    console.log('Step result for', step.id, ':', JSON.stringify(result, null, 2));

    const validations = result?.validation?.validations || result?.validations || [];
    // Only check the step definition, not the result - result may have extra fields
    const isHttp = step?.type === 'http';

    // Get stdout from any possible location in the result
    const stdout = result?.stdout || result?.output || result?.standardOutput || result?.out || '';
    const stderr = result?.stderr || result?.standardError || result?.err || '';
    const exitCode = result?.exitCode ?? result?.exit_code ?? result?.code;

    return (
      <div className="step-details">
        {/* Command or HTTP Request */}
        {isHttp && result?.http?.url && (
          <div className="detail-section">
            <h5>Request</h5>
            <code>{result.http.method || 'GET'} {result.http.url}</code>
          </div>
        )}
        {!isHttp && result?.args && (
          <div className="detail-section">
            <h5>Command</h5>
            <code>{Array.isArray(result.args) ? result.args.join(' ') : result.args}</code>
          </div>
        )}

        {/* Exit Code / Status Code + Duration - matching CLIResults layout */}
        <div className="detail-row">
          {isHttp ? (
            <>
              <div className="detail-section">
                <h5>Status Code</h5>
                <span className={result?.statusCode < 400 ? 'success' : 'error'}>
                  {result?.statusCode ?? 'N/A'}
                </span>
              </div>
              <div className="detail-section">
                <h5>Duration</h5>
                <span>{result?.duration || result?.pollDuration || 0}ms</span>
                {result?.pollAttempts > 1 && (
                  <span className="poll-info"> ({result.pollAttempts} attempts)</span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="detail-section">
                <h5>Exit Code</h5>
                <span className={exitCode === 0 ? 'success' : 'error'}>
                  {exitCode ?? 'N/A'}
                </span>
              </div>
              <div className="detail-section">
                <h5>Duration</h5>
                <span>{result?.duration || 0}ms</span>
              </div>
            </>
          )}
        </div>

        {/* HTTP Response */}
        {isHttp && (result?.responseBody || result?.statusCode) && (
          <div className="detail-section">
            <h5>Response</h5>
            {result.statusCode && (
              <div className="http-status">
                Status: <span className={result.statusCode < 400 ? 'success' : 'error'}>{result.statusCode}</span>
              </div>
            )}
            {result.responseBody && (() => {
              const formatted = formatJsonOutput(result.responseBody);
              return (
                <pre className={`output json-output ${formatted.lineCount > 20 ? 'scrollable' : ''}`}>
                  {formatted.formatted}
                </pre>
              );
            })()}
          </div>
        )}

        {/* Command stdout - ALWAYS show for non-HTTP steps */}
        {!isHttp && (
          <div className="detail-section">
            <h5>stdout</h5>
            <pre className="output">{cleanCliOutput(stdout) || '(no output)'}</pre>
          </div>
        )}

        {/* stderr - only show if there's content */}
        {stderr && (
          <div className="detail-section">
            <h5>stderr</h5>
            <pre className="output error">{stderr}</pre>
          </div>
        )}

        {/* Validations */}
        {validations.length > 0 && (
          <div className="detail-section">
            <h5>Validations</h5>
            <div className="validations-list">
              {validations.map((v, i) => (
                <div key={i} className={`validation-item ${v.passed ? 'pass' : 'fail'}`}>
                  <span className="validation-icon">{v.passed ? '✓' : '✕'}</span>
                  <span className="validation-type">{v.type}</span>
                  {v.expected !== undefined && (
                    <span className="validation-expected">
                      expected: {JSON.stringify(v.expected)}
                    </span>
                  )}
                  {v.actual !== undefined && !v.passed && (
                    <span className="validation-actual">
                      got: {JSON.stringify(v.actual)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="run-modal-overlay" onClick={handleClose}>
      <div className={`run-modal ${isRunning ? 'running' : ''}`} onClick={(e) => e.stopPropagation()}>
        <h3>Run Test {tests.length > 1 ? 'Suites' : 'Suite'}</h3>

        {!isRunning ? (
          <>
            <div className="run-modal-subtitle">
              <p>Test Suite: <strong>{testNames[0]}</strong></p>
            </div>

            <div className="form-group">
              <label>Executable</label>
              <div className="executable-selector">
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  style={{ display: 'none' }}
                />
                {executableName ? (
                  <div className="selected-executable">
                    <span className="file-name">{executableName}</span>
                    <button type="button" className="clear-btn" onClick={clearExecutable}>
                      x
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="upload-executable-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Upload Executable
                  </button>
                )}
              </div>
            </div>

            {/* Configurations Section */}
            {hasVariables && (
              <div className="configurations-section">
                <div className="configurations-header">
                  <label>Configurations</label>
                  <button className="add-config-btn" onClick={() => addConfiguration()}>
                    + Add
                  </button>
                </div>

                <div className="configurations-list">
                  {configurations.map((config, index) => (
                    <div key={config.id} className="config-card">
                      <div className="config-header" onClick={() => toggleConfigExpand(config.id)}>
                        <span className="config-expand">{expandedConfigs[config.id] ? '▼' : '▶'}</span>
                        <input
                          type="text"
                          className="config-name-input"
                          value={config.name}
                          onChange={(e) => {
                            e.stopPropagation();
                            updateConfigName(config.id, e.target.value);
                          }}
                          onClick={(e) => e.stopPropagation()}
                          placeholder={`Run ${index + 1}`}
                        />
                        {configurations.length > 1 && (
                          <button
                            className="remove-config-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeConfiguration(config.id);
                            }}
                          >
                            ×
                          </button>
                        )}
                      </div>

                      {expandedConfigs[config.id] && (
                        <div className="config-variables">
                          {workflowVariables.map(v => (
                            <div key={v.name} className="config-var-row">
                              <label className="config-var-label" title={v.description}>
                                {v.name}:
                              </label>
                              <input
                                type="text"
                                className="config-var-input"
                                value={config.variables[v.name] || ''}
                                onChange={(e) => updateConfigVariable(config.id, v.name, e.target.value)}
                                placeholder={v.defaultValue || ''}
                              />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

              </div>
            )}

            {error && <div className="run-modal-error">{error}</div>}

            <div className="run-modal-actions">
              <button className="cancel-btn" onClick={onClose}>
                Cancel
              </button>
              <button className="run-btn" onClick={handleRun}>
                {configurations.length > 1
                  ? `Run ${configurations.length} Configurations`
                  : 'Run Test'}
              </button>
            </div>
          </>
        ) : isRunning ? (
          <div className="run-progress">
            {/* Header with summary */}
            <div className="progress-header">
              <span className="progress-title">
                <strong>{currentTest?.name || 'Test'}</strong>
                {isFinished && (() => {
                  const passedCount = completedConfigs.filter(c => c.passed).length;
                  const failedCount = completedConfigs.filter(c => !c.passed).length;
                  return (
                    <span className={`result-summary ${failedCount === 0 ? 'all-passed' : 'has-failures'}`}>
                      {failedCount === 0
                        ? ` - All ${passedCount} configuration${passedCount > 1 ? 's' : ''} passed`
                        : ` - ${passedCount} passed, ${failedCount} failed`}
                    </span>
                  );
                })()}
              </span>
              {!isFinished && statusMessage && (
                <span className="progress-status">{statusMessage}</span>
              )}
            </div>

            {/* Configuration cards */}
            <div className="config-results-list">
              {configurations.map((config) => {
                const progress = configProgress[config.id] || {};
                const configStatus = progress.status || 'pending';
                const stepProgress = progress.stepProgress || {};
                const stepResults = progress.stepResults || {};
                const configExpandedSteps = progress.expandedSteps || {};
                const isConfigExpanded = expandedConfigs[config.id] !== false;

                return (
                  <div key={config.id} className={`config-result-card ${configStatus}`}>
                    <div
                      className="config-result-header"
                      onClick={() => toggleConfigExpand(config.id)}
                    >
                      <span className={`config-status-icon ${configStatus}`}>
                        {configStatus === 'running' ? '◐' :
                         configStatus === 'passed' ? '✓' :
                         configStatus === 'failed' ? '✕' : '○'}
                      </span>
                      <span className="config-result-name">{config.name}</span>
                      {Object.keys(config.variables).length > 0 && (
                        <span className="config-vars-summary">
                          {Object.entries(config.variables).map(([k, v]) => `${k}=${v}`).join(', ')}
                        </span>
                      )}
                      <span className="config-expand-icon">{isConfigExpanded ? '▼' : '▶'}</span>
                    </div>

                    {isConfigExpanded && (
                      <div className="config-steps">
                        {currentSteps.map((step) => {
                          const status = stepProgress[step.id] || 'pending';
                          const result = stepResults[step.id];
                          const isStepExpanded = configExpandedSteps[step.id];
                          const hasResult = result && (status === 'passed' || status === 'failed');

                          return (
                            <div key={step.id} className={`progress-step ${status}`}>
                              <div
                                className={`step-row ${hasResult ? 'clickable' : ''}`}
                                onClick={() => hasResult && toggleConfigStepExpand(config.id, step.id)}
                              >
                                {getStepIcon(status)}
                                <span className="step-name">{step.name || step.id}</span>
                                {status === 'running' && (
                                  <span className="step-spinner"></span>
                                )}
                                {result?.duration && (
                                  <span className="step-duration">{result.duration}ms</span>
                                )}
                                {hasResult && (
                                  <span className="expand-icon">{isStepExpanded ? '▼' : '▶'}</span>
                                )}
                              </div>

                              {status === 'failed' && result && !isStepExpanded && (
                                <div className="failure-summary">
                                  <span className="failure-reason">{getFailureReason(result)}</span>
                                </div>
                              )}

                              {isStepExpanded && renderStepDetails(step, result)}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {error && <div className="run-modal-error">{error}</div>}

            <div className="run-modal-actions">
              {isFinished ? (
                <button className="run-btn" onClick={handleClose}>
                  Close
                </button>
              ) : (
                <button className="cancel-btn" disabled>
                  Running...
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
