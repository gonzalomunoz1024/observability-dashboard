import { useState, useEffect } from 'react';
import { WorkflowBuilder } from './WorkflowBuilder';
import { RunModal } from './RunModal';
import { CLIResults } from './CLIResults';
import { runWorkflow, uploadExecutable } from '../../utils/cli';
import { getSavedWorkflows } from '../../utils/workflowStorage';
import './CLIPanel.css';

export function CLIPanel({ serviceId }) {
  const [activeTab, setActiveTab] = useState('execute'); // 'execute' | 'create'
  const [savedTests, setSavedTests] = useState([]);
  const [results, setResults] = useState([]);
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(null);
  const [testToRun, setTestToRun] = useState(null);
  const [workflowToEdit, setWorkflowToEdit] = useState(null);

  useEffect(() => {
    loadSavedTests();
  }, []);

  const loadSavedTests = () => {
    setSavedTests(getSavedWorkflows());
  };

  const handleRunTest = async (workflow, executable, options = {}) => {
    setError(null);
    setIsRunning(workflow.id);

    try {
      // If executable is a File, upload it first to get the server path
      let executablePath = executable;
      let executableName = 'CLI';

      if (executable instanceof File) {
        const uploadResult = await uploadExecutable(executable);
        executablePath = uploadResult.path;
        executableName = executable.name;
      } else if (typeof executable === 'string') {
        executablePath = executable;
        executableName = executable;
      }

      const formatted = formatWorkflowForExecution(workflow, executablePath);
      const result = await runWorkflow(formatted);

      // Transform backend response to expected structure
      // Backend returns: { steps: [...], summary: {...}, passed: bool }
      // Frontend expects: { results: [...], summary: {...}, passed: bool }
      // where each result has { validation: { passed, validations: [...] }, ... }
      const steps = result?.steps || result?.results || [];
      const transformedResults = steps.map(step => ({
        ...step,
        name: step.name || step.id,
        args: step.args,
        exitCode: step.exitCode,
        stdout: step.stdout,
        stderr: step.stderr,
        duration: step.duration,
        validation: {
          passed: step.passed ?? false,
          validations: step.validations || []
        }
      }));

      const normalizedResult = {
        passed: result?.passed ?? false,
        summary: result?.summary || { total: 0, passed: 0, failed: 0, passRate: '0%' },
        results: transformedResults,
        timestamp: new Date().toISOString(),
        workflowName: workflow.name,
        executable: executableName
      };

      setResults((prev) => [normalizedResult, ...prev].slice(0, 20));
    } catch (err) {
      setError(err.message || 'Failed to run test. Make sure the backend server is running.');
    } finally {
      setIsRunning(null);
    }
  };

  const formatWorkflowForExecution = (workflow, executable) => {
    const env = workflow.envVars
      ? Object.fromEntries(
          workflow.envVars.split('\n').filter(Boolean).map((line) => {
            const [key, ...vals] = line.split('=');
            return [key.trim(), vals.join('=').trim()];
          })
        )
      : undefined;

    return {
      name: workflow.name,
      env,
      steps: workflow.steps.map((step) => ({
        id: step.id,
        name: step.name || step.id,
        executable,
        args: step.args ? step.args.split(' ').filter(Boolean) : [],
        timeout: step.timeout,
        dependsOn: step.dependsOn ? step.dependsOn.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
        stdinInputs: step.stdinInputs ? step.stdinInputs.split('\n').filter(Boolean) : undefined,
        stdinDelay: step.stdinDelay,
        expectations: {
          exitCode: step.expectations?.exitCode !== '' ? parseInt(step.expectations?.exitCode, 10) : undefined,
          stdoutContains: step.expectations?.stdoutContains
            ? step.expectations.stdoutContains.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
          stdoutMatches: step.expectations?.stdoutMatches || undefined,
          stderrEmpty: step.expectations?.stderrEmpty || undefined,
          stderrContains: step.expectations?.stderrContains
            ? step.expectations.stderrContains.split(',').map((s) => s.trim()).filter(Boolean)
            : undefined,
          maxDuration: step.expectations?.maxDuration ? parseInt(step.expectations.maxDuration, 10) : undefined,
        },
        capture: step.capture ? parseCapture(step.capture) : undefined,
        artifacts: step.artifacts ? parseArtifacts(step.artifacts) : undefined,
      })),
    };
  };

  const parseCapture = (captureStr) => {
    if (!captureStr) return undefined;
    try {
      const lines = captureStr.split('\n').filter(Boolean);
      const result = {};
      lines.forEach((line) => {
        const match = line.match(/^(\w+):\s*(.+)$/);
        if (match) {
          result[match[1]] = { source: 'stdout', regex: match[2] };
        }
      });
      return Object.keys(result).length > 0 ? result : undefined;
    } catch {
      return undefined;
    }
  };

  const parseArtifacts = (artifactsStr) => {
    if (!artifactsStr) return undefined;
    try {
      const lines = artifactsStr.split('\n').filter(Boolean);
      return lines.map((line) => {
        const parts = line.split('|').map((p) => p.trim());
        return {
          path: parts[0],
          exists: true,
          contains: parts[1] ? parts[1].split(',').map((s) => s.trim()) : undefined,
          yamlValid: parts.includes('yaml'),
          jsonValid: parts.includes('json'),
        };
      });
    } catch {
      return undefined;
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="cli-panel">
      <div className="cli-tabs">
        <button
          className={`cli-tab ${activeTab === 'execute' ? 'active' : ''}`}
          onClick={() => setActiveTab('execute')}
        >
          Execute
        </button>
        <button
          className={`cli-tab ${activeTab === 'create' ? 'active' : ''}`}
          onClick={() => { setActiveTab('create'); loadSavedTests(); }}
        >
          Create
        </button>
      </div>

      <div className="cli-tab-content">
        {activeTab === 'execute' && (
          <div className="execute-view">
            <div className="execute-sidebar">
              <div className="sidebar-header">
                <h3>Test Suites</h3>
              </div>

              {savedTests.length === 0 ? (
                <div className="empty-suites">
                  <p>No test suites yet</p>
                  <button onClick={() => setActiveTab('create')}>
                    Create your first test
                  </button>
                </div>
              ) : (
                <div className="suite-list">
                  {savedTests.map((test) => (
                    <div key={test.id} className="suite-item">
                      <div className="suite-info">
                        <span className="suite-name">{test.name}</span>
                        <span className="suite-meta">{test.steps?.length || 0} steps</span>
                      </div>
                      <div className="suite-actions">
                        <button
                          className="edit-btn"
                          onClick={() => {
                            setWorkflowToEdit(test);
                            setActiveTab('create');
                          }}
                        >
                          Edit
                        </button>
                        <button
                          className="run-btn"
                          onClick={() => setTestToRun(test)}
                          disabled={isRunning === test.id}
                        >
                          {isRunning === test.id ? '...' : 'Run'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="execute-main">
              <div className="results-header">
                <h3>Execution History</h3>
                {results.length > 0 && (
                  <button className="clear-btn" onClick={clearResults}>
                    Clear
                  </button>
                )}
              </div>

              {error && <div className="panel-error">{error}</div>}

              {results.length === 0 ? (
                <div className="empty-results">
                  <div className="empty-icon">&#9654;</div>
                  <h4>No test runs yet</h4>
                  <p>Select a test suite and click Run to execute tests</p>
                </div>
              ) : (
                <div className="results-list">
                  {results.map((result, index) => (
                    <div key={index} className="result-card">
                      <div className="result-header">
                        <span className={`result-status ${result.passed ? 'passed' : 'failed'}`}>
                          {result.passed ? 'PASSED' : 'FAILED'}
                        </span>
                        <span className="result-name">{result.workflowName}</span>
                        <span className="result-exe">{result.executable}</span>
                        <span className="result-time">
                          {new Date(result.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <CLIResults result={result} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'create' && (
          <div className="create-view">
            <WorkflowBuilder
              onSave={loadSavedTests}
              onSaveComplete={() => {
                setActiveTab('execute');
                setWorkflowToEdit(null);
              }}
              initialWorkflow={workflowToEdit}
              onCancelEdit={() => {
                setWorkflowToEdit(null);
                setActiveTab('execute');
              }}
            />
          </div>
        )}
      </div>

      {testToRun && (
        <RunModal
          testName={testToRun.name}
          onRun={async (executable, options) => {
            await handleRunTest(testToRun, executable, options);
            setTestToRun(null);
          }}
          onClose={() => setTestToRun(null)}
        />
      )}
    </div>
  );
}
