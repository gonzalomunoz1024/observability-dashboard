import { useState, useEffect, useCallback } from 'react';
import {
  getTests,
  getSuites,
  saveSuite,
  deleteSuite,
  deleteTest,
  getTestsForSuite,
  formatTestsForExecution
} from '../../utils/testStorage';
import './SuiteManager.css';

export function SuiteManager({ onRunSuite, onBack }) {
  const [tests, setTests] = useState([]);
  const [suites, setSuites] = useState([]);
  const [selectedTests, setSelectedTests] = useState([]);
  const [suiteName, setSuiteName] = useState('');
  const [view, setView] = useState('list'); // 'list' | 'create' | 'viewSuite'
  const [activeSuite, setActiveSuite] = useState(null);
  const [error, setError] = useState(null);

  const refreshData = useCallback(() => {
    setTests(getTests());
    setSuites(getSuites());
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleToggleTest = (testId) => {
    setSelectedTests(prev =>
      prev.includes(testId)
        ? prev.filter(id => id !== testId)
        : [...prev, testId]
    );
  };

  const handleCreateSuite = () => {
    if (!suiteName.trim()) {
      setError('Suite name is required');
      return;
    }
    if (selectedTests.length === 0) {
      setError('Select at least one test');
      return;
    }

    saveSuite({
      name: suiteName.trim(),
      testIds: selectedTests
    });

    setSuiteName('');
    setSelectedTests([]);
    setError(null);
    setView('list');
    refreshData();
  };

  const handleDeleteSuite = (suiteId) => {
    if (window.confirm('Delete this suite?')) {
      deleteSuite(suiteId);
      refreshData();
    }
  };

  const handleDeleteTest = (testId) => {
    if (window.confirm('Delete this test? It will be removed from all suites.')) {
      deleteTest(testId);
      refreshData();
    }
  };

  const handleViewSuite = (suite) => {
    setActiveSuite(suite);
    setView('viewSuite');
  };

  const handleRunSuite = (suite) => {
    const suiteTests = getTestsForSuite(suite.id);
    const formatted = formatTestsForExecution(suiteTests);
    onRunSuite(suite.name, formatted);
  };

  const handleSelectAll = () => {
    if (selectedTests.length === tests.length) {
      setSelectedTests([]);
    } else {
      setSelectedTests(tests.map(t => t.id));
    }
  };

  if (view === 'create') {
    return (
      <div className="suite-manager">
        <div className="suite-header">
          <button className="back-btn" onClick={() => setView('list')}>
            ← Back
          </button>
          <h3>Create Suite</h3>
        </div>

        <div className="create-suite-form">
          <div className="form-group">
            <label>Suite Name</label>
            <input
              type="text"
              value={suiteName}
              onChange={(e) => setSuiteName(e.target.value)}
              placeholder="e.g., Smoke Tests"
            />
          </div>

          <div className="test-selection">
            <div className="selection-header">
              <span>Select Tests ({selectedTests.length} selected)</span>
              <button type="button" className="select-all-btn" onClick={handleSelectAll}>
                {selectedTests.length === tests.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            {tests.length === 0 ? (
              <div className="no-tests">No saved tests. Create and save tests first.</div>
            ) : (
              <div className="test-list">
                {tests.map(test => (
                  <label key={test.id} className="test-item">
                    <input
                      type="checkbox"
                      checked={selectedTests.includes(test.id)}
                      onChange={() => handleToggleTest(test.id)}
                    />
                    <div className="test-info">
                      <span className="test-name">{test.name}</span>
                      <span className="test-cmd">{test.executable} {test.args}</span>
                    </div>
                  </label>
                ))}
              </div>
            )}
          </div>

          {error && <div className="suite-error">{error}</div>}

          <button
            type="button"
            className="create-suite-btn"
            onClick={handleCreateSuite}
            disabled={tests.length === 0}
          >
            Create Suite
          </button>
        </div>
      </div>
    );
  }

  if (view === 'viewSuite' && activeSuite) {
    const suiteTests = getTestsForSuite(activeSuite.id);
    return (
      <div className="suite-manager">
        <div className="suite-header">
          <button className="back-btn" onClick={() => setView('list')}>
            ← Back
          </button>
          <h3>{activeSuite.name}</h3>
        </div>

        <div className="suite-tests">
          <div className="suite-tests-header">
            <span>{suiteTests.length} tests in this suite</span>
            <button
              className="run-suite-btn"
              onClick={() => handleRunSuite(activeSuite)}
              disabled={suiteTests.length === 0}
            >
              Run Suite
            </button>
          </div>

          {suiteTests.length === 0 ? (
            <div className="no-tests">No tests in this suite (tests may have been deleted)</div>
          ) : (
            <div className="test-list readonly">
              {suiteTests.map(test => (
                <div key={test.id} className="test-item-readonly">
                  <div className="test-info">
                    <span className="test-name">{test.name}</span>
                    <span className="test-cmd">{test.executable} {test.args}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default: list view
  return (
    <div className="suite-manager">
      <div className="suite-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h3>Test Suites</h3>
      </div>

      {/* Saved Tests Section */}
      <div className="section">
        <div className="section-header">
          <h4>Saved Tests</h4>
          <span className="count">{tests.length}</span>
        </div>
        {tests.length === 0 ? (
          <div className="empty-state">
            No saved tests yet. Create tests and click "Save" to add them here.
          </div>
        ) : (
          <div className="test-list compact">
            {tests.map(test => (
              <div key={test.id} className="test-item-compact">
                <div className="test-info">
                  <span className="test-name">{test.name}</span>
                  <span className="test-cmd">{test.executable} {test.args}</span>
                </div>
                <button
                  className="delete-btn"
                  onClick={() => handleDeleteTest(test.id)}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Suites Section */}
      <div className="section">
        <div className="section-header">
          <h4>Suites</h4>
          <button
            className="create-btn"
            onClick={() => setView('create')}
            disabled={tests.length === 0}
          >
            + Create Suite
          </button>
        </div>
        {suites.length === 0 ? (
          <div className="empty-state">
            No suites yet. Create a suite to run multiple tests in parallel.
          </div>
        ) : (
          <div className="suite-list">
            {suites.map(suite => {
              const suiteTests = getTestsForSuite(suite.id);
              return (
                <div key={suite.id} className="suite-card">
                  <div className="suite-info" onClick={() => handleViewSuite(suite)}>
                    <span className="suite-name">{suite.name}</span>
                    <span className="suite-count">{suiteTests.length} tests</span>
                  </div>
                  <div className="suite-actions">
                    <button
                      className="run-btn"
                      onClick={() => handleRunSuite(suite)}
                      disabled={suiteTests.length === 0}
                    >
                      Run
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDeleteSuite(suite.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
