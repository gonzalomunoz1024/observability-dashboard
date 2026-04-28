import { useState, useRef, useEffect } from 'react';
import { uploadExecutable, runWorkflowStreaming, cancelWorkflow } from '../../utils/cli';
import { formatWorkflowForExecution } from '../../utils/workflowFormatter';
import { StepDetails } from './StepDetails';
import './RunModal.css';

export function RunModal({ tests = [], onClose, onResult }) {
  const [executableFile, setExecutableFile] = useState(null);
  const [executableName, setExecutableName] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const [activeStreamIds, setActiveStreamIds] = useState({}); // configId -> streamId

  // Configurations for parallel runs with different variable values
  const [configurations, setConfigurations] = useState([]);
  const [expandedConfigs, setExpandedConfigs] = useState({});

  // Progress tracking per configuration
  const [configProgress, setConfigProgress] = useState({}); // { configId: { stepProgress: {}, stepResults: {}, status: 'pending'|'running'|'passed'|'failed' } }
  const [completedConfigs, setCompletedConfigs] = useState([]);
  const [statusMessage, setStatusMessage] = useState('');

  // Elapsed time tracking for running steps
  const [stepStartTimes, setStepStartTimes] = useState({}); // { `${configId}-${stepId}`: timestamp }
  const [elapsedTick, setElapsedTick] = useState(0); // Force re-render for elapsed time
  const timerRef = useRef(null);

  // Live output tracking per step
  const [liveOutput, setLiveOutput] = useState({}); // { `${configId}-${stepId}`: { stdout: '', stderr: '' } }
  const [capturedVars, setCapturedVars] = useState({}); // { `${configId}-${stepId}`: { varName: value, ... } }
  const outputRefs = useRef({}); // Refs for auto-scrolling

  // Start/stop elapsed time ticker when running
  useEffect(() => {
    if (isRunning) {
      timerRef.current = setInterval(() => {
        setElapsedTick(t => t + 1);
      }, 1000);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [isRunning]);

  // Helper to format elapsed time
  const formatElapsed = (startTime) => {
    if (!startTime) return '';
    const elapsed = Math.floor((Date.now() - startTime) / 1000);
    const mins = Math.floor(elapsed / 60);
    const secs = elapsed % 60;
    if (mins > 0) {
      return `${mins}m ${secs}s`;
    }
    return `${secs}s`;
  };

  const testNames = tests.map(t => t.name);

  // Get all workflow variables from the first test (they should be the same)
  const workflowVariables = tests[0]?.variables || [];
  const hasVariables = workflowVariables.length > 0;

  // Get unique variable identifier (handles empty or duplicate names)
  const getVarId = (v, index) => v.name || `var-${index}`;

  // Initialize configurations when modal opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const initConfigs = () => {
    if (configurations.length === 0 && tests.length > 0) {
      const configId = `config-${Date.now()}`;
      const defaultVars = {};
      workflowVariables.forEach((v, index) => {
        const varId = getVarId(v, index);
        defaultVars[varId] = v.defaultValue || '';
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
      workflowVariables.forEach((v, index) => {
        const varId = getVarId(v, index);
        newVars[varId] = v.defaultValue || '';
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

  // Run a single configuration with streaming output
  const runConfiguration = async (config, test, executablePath) => {
    const configId = config.id;
    const firstStepId = test.steps[0]?.id;

    // Initialize progress for this config
    const initialStepProgress = {};
    test.steps.forEach((step, idx) => {
      initialStepProgress[step.id] = idx === 0 ? 'running' : 'pending';
    });

    // Track start time for the first step
    if (firstStepId) {
      setStepStartTimes(prev => ({
        ...prev,
        [`${configId}-${firstStepId}`]: Date.now()
      }));
    }

    // Initialize live output for all steps
    test.steps.forEach(step => {
      setLiveOutput(prev => ({
        ...prev,
        [`${configId}-${step.id}`]: { stdout: '', stderr: '' }
      }));
    });

    setConfigProgress(prev => ({
      ...prev,
      [configId]: {
        status: 'running',
        stepProgress: initialStepProgress,
        stepResults: {},
        expandedSteps: { [firstStepId]: true }, // Auto-expand first step to show output
        currentStepId: firstStepId
      }
    }));

    try {
      // Format workflow with this config's variables
      const formatted = formatWorkflowForExecution(test, executablePath, config.variables);
      console.log(`Running config ${config.name}:`, formatted);

      let finalResult = null;

      await runWorkflowStreaming(formatted, {
        onStreamId: (streamId) => {
          console.log('Stream ID:', streamId);
          setActiveStreamIds(prev => ({ ...prev, [configId]: streamId }));
        },

        onStart: (data) => {
          console.log('Workflow started:', data);
        },

        onStepStart: (stepId, data) => {
          // Track start time for this step
          setStepStartTimes(prev => ({
            ...prev,
            [`${configId}-${stepId}`]: Date.now()
          }));

          setConfigProgress(prev => ({
            ...prev,
            [configId]: {
              ...prev[configId],
              stepProgress: { ...prev[configId]?.stepProgress, [stepId]: 'running' },
              expandedSteps: { ...prev[configId]?.expandedSteps, [stepId]: true },
              currentStepId: stepId
            }
          }));
        },

        onOutput: (stepId, output) => {
          // Append live output
          setLiveOutput(prev => {
            const key = `${configId}-${stepId}`;
            const current = prev[key] || { stdout: '', stderr: '' };
            if (output.type === 'stdout') {
              return { ...prev, [key]: { ...current, stdout: current.stdout + output.data } };
            } else if (output.type === 'stderr') {
              return { ...prev, [key]: { ...current, stderr: current.stderr + output.data } };
            }
            return prev;
          });
        },

        onStepComplete: (stepId, stepResult) => {
          const passed = stepResult?.passed;
          setConfigProgress(prev => ({
            ...prev,
            [configId]: {
              ...prev[configId],
              stepProgress: { ...prev[configId]?.stepProgress, [stepId]: passed ? 'passed' : 'failed' },
              stepResults: { ...prev[configId]?.stepResults, [stepId]: stepResult },
              expandedSteps: !passed
                ? { ...prev[configId]?.expandedSteps, [stepId]: true }
                : prev[configId]?.expandedSteps
            }
          }));
        },

        onCapture: (varName, value, stepId) => {
          setCapturedVars(prev => {
            const key = `${configId}-${stepId}`;
            return {
              ...prev,
              [key]: { ...(prev[key] || {}), [varName]: value }
            };
          });
        },

        onComplete: (result) => {
          finalResult = result;
          const allPassed = result?.passed ?? false;

          setConfigProgress(prev => ({
            ...prev,
            [configId]: {
              ...prev[configId],
              status: allPassed ? 'passed' : 'failed',
              result
            }
          }));

          // Pass result back to parent for Execution History
          if (onResult) {
            onResult(test, result, executablePath, config);
          }
        },

        onError: (errorMessage) => {
          setConfigProgress(prev => ({
            ...prev,
            [configId]: {
              ...prev[configId],
              status: 'failed',
              error: errorMessage
            }
          }));
        }
      });

      return { config, result: finalResult, passed: finalResult?.passed ?? false };
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
      workflowVariables.forEach((v, index) => {
        const varId = getVarId(v, index);
        defaultVars[varId] = v.defaultValue || '';
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

  const handleCancel = async () => {
    // Cancel all active workflows
    const streamIds = Object.values(activeStreamIds);
    for (const streamId of streamIds) {
      if (streamId) {
        try {
          await cancelWorkflow(streamId);
          console.log('Cancelled workflow:', streamId);
        } catch (err) {
          console.error('Failed to cancel workflow:', err);
        }
      }
    }
    setStatusMessage('Cancelled');
    setIsRunning(false);
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
                          {workflowVariables.map((v, varIndex) => {
                            const varId = getVarId(v, varIndex);
                            return (
                              <div key={varIndex} className="config-var-row">
                                <label className="config-var-label" title={v.description}>
                                  {v.name || `Variable ${varIndex + 1}`}:
                                </label>
                                <input
                                  type="text"
                                  className="config-var-input"
                                  value={config.variables[varId] || ''}
                                  onChange={(e) => updateConfigVariable(config.id, varId, e.target.value)}
                                  placeholder={v.defaultValue || ''}
                                />
                              </div>
                            );
                          })}
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
                          const stepStartTime = stepStartTimes[`${config.id}-${step.id}`];
                          const elapsedSeconds = stepStartTime ? Math.floor((Date.now() - stepStartTime) / 1000) : 0;
                          const isLongRunning = status === 'running' && elapsedSeconds > 30;
                          const maybeWaitingForInput = status === 'running' && elapsedSeconds > 60 && step.type !== 'http';

                          return (
                            <div key={step.id} className={`progress-step ${status}`}>
                              <div
                                className={`step-row ${hasResult || status === 'running' ? 'clickable' : ''}`}
                                onClick={() => (hasResult || status === 'running') && toggleConfigStepExpand(config.id, step.id)}
                              >
                                {getStepIcon(status)}
                                <span className="step-name">{step.name || step.id}</span>
                                {status === 'running' && (
                                  <>
                                    <span className="step-spinner"></span>
                                    <span className={`step-elapsed ${isLongRunning ? 'warning' : ''}`}>
                                      {formatElapsed(stepStartTime)}
                                    </span>
                                  </>
                                )}
                                {result?.duration && (
                                  <span className="step-duration">{result.duration}ms</span>
                                )}
                                {(hasResult || status === 'running') && (
                                  <span className="expand-icon">{isStepExpanded ? '▼' : '▶'}</span>
                                )}
                              </div>

                              {/* Show command being executed for running steps */}
                              {status === 'running' && step.type !== 'http' && step.args && (
                                <div className="running-command">
                                  <code>{step.args}</code>
                                </div>
                              )}
                              {status === 'running' && step.type === 'http' && step.http?.url && (
                                <div className="running-command">
                                  <code>{step.http.method || 'GET'} {step.http.url}</code>
                                </div>
                              )}

                              {/* Live output display for running steps */}
                              {status === 'running' && isStepExpanded && (() => {
                                const output = liveOutput[`${config.id}-${step.id}`];
                                const hasOutput = output?.stdout || output?.stderr;
                                return (
                                  <div className="live-output">
                                    {hasOutput ? (
                                      <>
                                        {output.stdout && (
                                          <div className="live-output-section">
                                            <span className="live-output-label">stdout:</span>
                                            <pre className="live-output-content">{output.stdout}</pre>
                                          </div>
                                        )}
                                        {output.stderr && (
                                          <div className="live-output-section stderr">
                                            <span className="live-output-label">stderr:</span>
                                            <pre className="live-output-content">{output.stderr}</pre>
                                          </div>
                                        )}
                                      </>
                                    ) : (
                                      <div className="live-output-section">
                                        <span className="live-output-waiting">Waiting for output...</span>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}

                              {/* Warning for potentially stuck process */}
                              {maybeWaitingForInput && (
                                <div className="step-warning">
                                  <span className="warning-icon">&#9888;</span>
                                  <span>Taking longer than expected. Process may be waiting for stdin input, hanging, or performing a long operation.</span>
                                </div>
                              )}

                              {status === 'failed' && result && !isStepExpanded && (
                                <div className="failure-summary">
                                  <span className="failure-reason">{getFailureReason(result)}</span>
                                </div>
                              )}

                              {isStepExpanded && (
                                <StepDetails
                                  step={step}
                                  result={result}
                                  captures={capturedVars[`${config.id}-${step.id}`] || {}}
                                />
                              )}
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
              {isFinished || statusMessage === 'Cancelled' ? (
                <button className="run-btn" onClick={handleClose}>
                  Close
                </button>
              ) : (
                <button className="cancel-btn" onClick={handleCancel}>
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
