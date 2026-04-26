import { useState } from 'react';
import { cleanCliOutput } from '../../utils/outputCleaner';
import './CLIResults.css';

export function CLIResults({ result }) {
  // Auto-expand failed tests by default
  const getInitialExpanded = () => {
    if (!result?.results) return {};
    const expanded = {};
    result.results.forEach((test, index) => {
      if (!test?.validation?.passed) {
        expanded[index] = true;
      }
    });
    return expanded;
  };

  const [expandedTests, setExpandedTests] = useState(getInitialExpanded);

  if (!result) return null;

  const { summary, results } = result;

  // Guard against missing data
  if (!summary || !results || !Array.isArray(results)) {
    return (
      <div className="cli-results">
        <div className="results-error">
          No test results available. The server may not have returned valid data.
        </div>
      </div>
    );
  }

  const toggleExpand = (index) => {
    setExpandedTests((prev) => ({
      ...prev,
      [index]: !prev[index],
    }));
  };

  // Get failure reasons for quick summary
  const getFailureReason = (test) => {
    if (!test?.validation?.validations) return 'Unknown error';
    const failed = test.validation.validations.filter(v => !v.passed);
    if (failed.length === 0) return 'Unknown error';
    return failed.map(v => {
      if (v.type === 'exitCode') return `Exit code: expected ${v.expected}, got ${v.actual}`;
      if (v.type === 'stdoutContains') return `Missing in output: "${v.expected}"`;
      if (v.type === 'stderrEmpty') return 'Stderr was not empty';
      if (v.type === 'maxDuration') return `Took ${v.actual}ms (max: ${v.expected}ms)`;
      if (v.type === 'statusCode') return `Status: expected ${v.expected}, got ${v.actual}`;
      return v.type;
    }).join(', ');
  };

  // Try to pretty print JSON and add line numbers
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

  // Check if step is HTTP type
  const isHttpStep = (test) => test?.type === 'http' || test?.http;

  return (
    <div className="cli-results">
      <div className="results-summary">
        <h3>Test Results</h3>
        <div className="summary-stats">
          <div className={`stat ${summary.failed === 0 ? 'all-passed' : 'has-failures'}`}>
            <span className="stat-value">{summary.passRate}</span>
            <span className="stat-label">Pass Rate</span>
          </div>
          <div className="stat passed">
            <span className="stat-value">{summary.passed}</span>
            <span className="stat-label">Passed</span>
          </div>
          <div className="stat failed">
            <span className="stat-value">{summary.failed}</span>
            <span className="stat-label">Failed</span>
          </div>
          <div className="stat total">
            <span className="stat-value">{summary.total}</span>
            <span className="stat-label">Total</span>
          </div>
        </div>
      </div>

      <div className="test-results-list">
        {results.map((test, index) => (
          <div
            key={index}
            className={`test-result ${test?.validation?.passed ? 'passed' : 'failed'}`}
          >
            <div className="test-result-header" onClick={() => toggleExpand(index)}>
              <div className="test-info">
                <span className={`status-icon ${test?.validation?.passed ? 'pass' : 'fail'}`}>
                  {test?.validation?.passed ? '✓' : '✕'}
                </span>
                <span className="test-name">{test?.name || `Step ${index + 1}`}</span>
              </div>
              <div className="test-meta">
                <span className="duration">{test?.duration || 0}ms</span>
                <span className="expand-icon">{expandedTests[index] ? '▼' : '▶'}</span>
              </div>
            </div>

            {/* Show failure reason prominently for failed tests */}
            {!test?.validation?.passed && (
              <div className="failure-summary">
                <span className="failure-label">Failed:</span>
                <span className="failure-reason">{getFailureReason(test)}</span>
              </div>
            )}

            {expandedTests[index] && (
              <div className="test-details">
                {isHttpStep(test) && test?.http?.url && (
                  <div className="detail-section">
                    <h5>Request</h5>
                    <code>{test.http.method || 'GET'} {test.http.url}</code>
                  </div>
                )}
                {!isHttpStep(test) && test?.args && (
                  <div className="detail-section">
                    <h5>Command</h5>
                    <code>{Array.isArray(test.args) ? test.args.join(' ') : test.args}</code>
                  </div>
                )}

                <div className="detail-row">
                  {isHttpStep(test) ? (
                    <>
                      <div className="detail-section">
                        <h5>Status Code</h5>
                        <span className={test?.statusCode < 400 ? 'success' : 'error'}>
                          {test?.statusCode ?? 'N/A'}
                        </span>
                      </div>
                      <div className="detail-section">
                        <h5>Duration</h5>
                        <span>{test?.duration || test?.pollDuration || 0}ms</span>
                        {test?.pollAttempts > 1 && (
                          <span className="poll-info"> ({test.pollAttempts} attempts)</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="detail-section">
                        <h5>Exit Code</h5>
                        <span className={test?.exitCode === 0 ? 'success' : 'error'}>
                          {test?.exitCode ?? 'N/A'}
                        </span>
                      </div>
                      <div className="detail-section">
                        <h5>Duration</h5>
                        <span>{test?.duration || 0}ms</span>
                      </div>
                    </>
                  )}
                </div>

                {/* HTTP Response */}
                {isHttpStep(test) && (test?.responseBody || test?.statusCode) && (
                  <div className="detail-section">
                    <h5>Response</h5>
                    {test.statusCode && (
                      <div className="http-status">
                        Status: <span className={test.statusCode < 400 ? 'success' : 'error'}>{test.statusCode}</span>
                      </div>
                    )}
                    {test.responseBody && (() => {
                      const formatted = formatJsonOutput(test.responseBody);
                      return (
                        <pre className={`output json-output ${formatted.lineCount > 20 ? 'scrollable' : ''}`}>
                          {formatted.formatted}
                        </pre>
                      );
                    })()}
                  </div>
                )}

                {/* Command stdout */}
                {!isHttpStep(test) && test?.stdout && (
                  <div className="detail-section">
                    <h5>stdout</h5>
                    <pre className="output">{cleanCliOutput(test.stdout)}</pre>
                  </div>
                )}

                {test?.stderr && (
                  <div className="detail-section">
                    <h5>stderr</h5>
                    <pre className="output error">{test.stderr}</pre>
                  </div>
                )}

                {test?.validation?.validations && test.validation.validations.length > 0 && (
                <div className="detail-section">
                  <h5>Validations</h5>
                  <div className="validations-list">
                    {test.validation.validations.map((v, i) => (
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
