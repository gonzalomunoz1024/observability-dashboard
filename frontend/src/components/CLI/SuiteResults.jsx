import { useState } from 'react';
import './SuiteResults.css';

export function SuiteResults({ result, onBack }) {
  const [expandedTests, setExpandedTests] = useState({});

  if (!result) return null;

  const { suiteName, passed, totalTests, passedCount, failedCount, duration, results } = result;

  const toggleExpand = (index) => {
    setExpandedTests((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  const passRate = totalTests > 0 ? Math.round((passedCount / totalTests) * 100) + '%' : '0%';

  return (
    <div className="suite-results">
      <div className="suite-results-header">
        <button className="back-btn" onClick={onBack}>
          ← Back
        </button>
        <h3>{suiteName}</h3>
        <span className={`suite-status ${passed ? 'passed' : 'failed'}`}>
          {passed ? 'PASSED' : 'FAILED'}
        </span>
      </div>

      <div className="results-summary">
        <div className="summary-stats">
          <div className={`stat ${failedCount === 0 ? 'all-passed' : 'has-failures'}`}>
            <span className="stat-value">{passRate}</span>
            <span className="stat-label">Pass Rate</span>
          </div>
          <div className="stat passed">
            <span className="stat-value">{passedCount}</span>
            <span className="stat-label">Passed</span>
          </div>
          <div className="stat failed">
            <span className="stat-value">{failedCount}</span>
            <span className="stat-label">Failed</span>
          </div>
          <div className="stat duration">
            <span className="stat-value">{duration}ms</span>
            <span className="stat-label">Total Time</span>
          </div>
        </div>
        <div className="parallel-badge">
          Executed in parallel
        </div>
      </div>

      <div className="test-results-list">
        {results.map((test, index) => (
          <div
            key={test.id || index}
            className={`test-result ${test.passed ? 'passed' : 'failed'}`}
          >
            <div className="test-result-header" onClick={() => toggleExpand(index)}>
              <div className="test-info">
                <span className={`status-icon ${test.passed ? 'pass' : 'fail'}`}>
                  {test.passed ? '✓' : '✕'}
                </span>
                <span className="test-name">{test.name}</span>
              </div>
              <div className="test-meta">
                <span className="duration">{test.duration}ms</span>
                <span className="expand-icon">{expandedTests[index] ? '▼' : '▶'}</span>
              </div>
            </div>

            {expandedTests[index] && (
              <div className="test-details">
                <div className="detail-section">
                  <h5>Command</h5>
                  <code>{test.executable} {Array.isArray(test.args) ? test.args.join(' ') : test.args}</code>
                </div>

                <div className="detail-row">
                  <div className="detail-section">
                    <h5>Exit Code</h5>
                    <span className={test.exitCode === 0 ? 'success' : 'error'}>
                      {test.exitCode}
                    </span>
                  </div>
                  <div className="detail-section">
                    <h5>Duration</h5>
                    <span>{test.duration}ms</span>
                  </div>
                </div>

                {test.stdout && (
                  <div className="detail-section">
                    <h5>stdout</h5>
                    <pre className="output">{test.stdout}</pre>
                  </div>
                )}

                {test.stderr && (
                  <div className="detail-section">
                    <h5>stderr</h5>
                    <pre className="output error">{test.stderr}</pre>
                  </div>
                )}

                {test.validations && test.validations.length > 0 && (
                  <div className="detail-section">
                    <h5>Validations</h5>
                    <div className="validations-list">
                      {test.validations.map((v, i) => (
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
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
