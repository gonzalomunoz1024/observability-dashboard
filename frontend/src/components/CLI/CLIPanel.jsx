import { useState, useEffect } from 'react';
import { WorkflowBuilder } from './WorkflowBuilder';
import { RunModal } from './RunModal';
import { CLIResults } from './CLIResults';
import { getSavedWorkflows, getExecutionHistory, saveExecutionResult, clearExecutionHistory } from '../../utils/workflowStorage';
import './CLIPanel.css';

export function CLIPanel({ serviceId }) {
  const [activeTab, setActiveTab] = useState('execute'); // 'execute' | 'create'
  const [savedTests, setSavedTests] = useState([]);
  const [results, setResults] = useState(() => getExecutionHistory());
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(null);
  const [testsToRun, setTestsToRun] = useState([]); // Changed to array
  const [selectedTests, setSelectedTests] = useState([]); // For multi-select
  const [workflowToEdit, setWorkflowToEdit] = useState(null);

  useEffect(() => {
    loadSavedTests();
  }, []);

  const loadSavedTests = () => {
    setSavedTests(getSavedWorkflows());
  };

  const clearResults = () => {
    clearExecutionHistory();
    setResults([]);
  };

  // Handle results from RunModal for Execution History
  const handleTestResult = (workflow, result, executablePath) => {
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
      summary: result?.summary || {
        total: steps.length,
        passed: steps.filter(s => s.passed).length,
        failed: steps.filter(s => !s.passed).length,
        passRate: steps.length > 0 ? `${Math.round(steps.filter(s => s.passed).length / steps.length * 100)}%` : '0%'
      },
      results: transformedResults,
      timestamp: new Date().toISOString(),
      workflowName: workflow.name,
      executable: executablePath
    };

    const updated = saveExecutionResult(normalizedResult);
    setResults(updated);
  };

  const toggleTestSelection = (testId) => {
    setSelectedTests(prev =>
      prev.includes(testId)
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    );
  };

  const selectAllTests = () => {
    if (selectedTests.length === savedTests.length) {
      setSelectedTests([]);
    } else {
      setSelectedTests(savedTests.map(t => t.id));
    }
  };

  const runSelectedTests = () => {
    const testsToExecute = savedTests.filter(t => selectedTests.includes(t.id));
    if (testsToExecute.length > 0) {
      setTestsToRun(testsToExecute);
    }
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
          onClick={() => { setActiveTab('create'); setWorkflowToEdit(null); loadSavedTests(); }}
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
                {savedTests.length > 0 && selectedTests.length > 0 && (
                  <button className="run-selected-btn" onClick={runSelectedTests}>
                    Run Selected ({selectedTests.length})
                  </button>
                )}
              </div>

              {savedTests.length === 0 ? (
                <div className="empty-suites">
                  <p>No test suites yet</p>
                  <button onClick={() => setActiveTab('create')}>
                    Create your first test
                  </button>
                </div>
              ) : (
                <>
                  <div className="suite-list-header">
                    <label className="select-all-checkbox">
                      <input
                        type="checkbox"
                        checked={selectedTests.length === savedTests.length}
                        onChange={selectAllTests}
                      />
                      Select All
                    </label>
                  </div>
                  <div className="suite-list">
                    {savedTests.map((test) => (
                      <div key={test.id} className={`suite-item ${selectedTests.includes(test.id) ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          className="suite-checkbox"
                          checked={selectedTests.includes(test.id)}
                          onChange={() => toggleTestSelection(test.id)}
                        />
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
                            onClick={() => setTestsToRun([test])}
                            disabled={isRunning === test.id}
                          >
                            {isRunning === test.id ? '...' : 'Run'}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
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

      {testsToRun.length > 0 && (
        <RunModal
          tests={testsToRun}
          onResult={handleTestResult}
          onClose={() => {
            setTestsToRun([]);
            setSelectedTests([]);
          }}
        />
      )}
    </div>
  );
}
