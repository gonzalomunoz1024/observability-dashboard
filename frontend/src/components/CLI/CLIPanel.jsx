import { useState, useEffect, useRef } from 'react';
import { WorkflowBuilder } from './WorkflowBuilder';
import { RunModal } from './RunModal';
import { CLIResults } from './CLIResults';
import { getSavedWorkflows, getExecutionHistory, saveExecutionResult, clearExecutionHistory, exportWorkflows, importWorkflows, deleteWorkflow } from '../../utils/workflowStorage';
import './CLIPanel.css';

export function CLIPanel({ serviceId }) {
  const [savedTests, setSavedTests] = useState([]);
  const [activeTab, setActiveTab] = useState(() => {
    // Auto-select 'create' tab if no tests exist for this service
    const tests = getSavedWorkflows(serviceId);
    return tests.length === 0 ? 'create' : 'execute';
  });
  const [results, setResults] = useState(() => getExecutionHistory(serviceId));
  const [error, setError] = useState(null);
  const [isRunning, setIsRunning] = useState(null);
  const [testsToRun, setTestsToRun] = useState([]); // Changed to array
  const [selectedTests, setSelectedTests] = useState([]); // For multi-select
  const [workflowToEdit, setWorkflowToEdit] = useState(null);
  const [importStatus, setImportStatus] = useState(null); // { type: 'success' | 'error', message: string }
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadSavedTests();
  }, [serviceId]);

  const loadSavedTests = () => {
    const tests = getSavedWorkflows(serviceId);
    setSavedTests(tests);
    // Auto-switch to create tab if no tests exist
    if (tests.length === 0) {
      setActiveTab('create');
    }
  };

  const clearResults = () => {
    clearExecutionHistory(serviceId);
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
      captures: step.captures || {},
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

    const updated = saveExecutionResult(normalizedResult, serviceId);
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

  const handleDeleteTest = (test) => {
    if (window.confirm(`Delete "${test.name}"? This will also delete all execution history for this test suite.`)) {
      deleteWorkflow(test.id);
      loadSavedTests();
      // Refresh results to reflect deleted history
      setResults(getExecutionHistory(serviceId));
      // Remove from selection if selected
      setSelectedTests(prev => prev.filter(id => id !== test.id));
    }
  };

  const handleExport = () => {
    const jsonData = exportWorkflows(serviceId);
    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `test-suites-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImport = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = importWorkflows(e.target.result, serviceId);
        loadSavedTests();
        setImportStatus({
          type: 'success',
          message: `Imported ${result.imported} test suite(s)${result.skipped > 0 ? `, ${result.skipped} skipped` : ''}`
        });
        setTimeout(() => setImportStatus(null), 5000);
      } catch (err) {
        setImportStatus({ type: 'error', message: err.message });
        setTimeout(() => setImportStatus(null), 5000);
      }
    };
    reader.readAsText(file);
    // Reset input so the same file can be selected again
    event.target.value = '';
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
                <div className="sidebar-header-actions">
                  <button
                    className="import-btn"
                    onClick={() => fileInputRef.current?.click()}
                    title="Import test suites from JSON"
                  >
                    Import
                  </button>
                  {savedTests.length > 0 && (
                    <button
                      className="export-btn"
                      onClick={handleExport}
                      title="Export test suites as JSON"
                    >
                      Export
                    </button>
                  )}
                  {savedTests.length > 0 && selectedTests.length > 0 && (
                    <button className="run-selected-btn" onClick={runSelectedTests}>
                      Run Selected ({selectedTests.length})
                    </button>
                  )}
                </div>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleImport}
                  accept=".json"
                  style={{ display: 'none' }}
                />
              </div>
              {importStatus && (
                <div className={`import-status ${importStatus.type}`}>
                  {importStatus.message}
                </div>
              )}

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
                          <button
                            className="delete-btn"
                            onClick={() => handleDeleteTest(test)}
                            title="Delete test suite"
                          >
                            Delete
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
              serviceId={serviceId}
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
