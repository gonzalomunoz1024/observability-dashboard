import { useState } from 'react';
import './WorkflowResults.css';

export function WorkflowResults({ result }) {
  const [expandedSteps, setExpandedSteps] = useState({});

  const toggleStep = (stepId) => {
    setExpandedSteps((prev) => ({
      ...prev,
      [stepId]: !prev[stepId],
    }));
  };

  const { summary, steps, workflowName, duration, variables } = result;

  return (
    <div className={`workflow-result ${result.passed ? 'passed' : 'failed'}`}>
      <div className="workflow-result-header">
        <div className="workflow-info">
          <span className={`status-badge ${result.passed ? 'pass' : 'fail'}`}>
            {result.passed ? 'PASSED' : 'FAILED'}
          </span>
          <span className="workflow-name">{workflowName}</span>
          <span className="workflow-time">
            {new Date(result.timestamp).toLocaleTimeString()}
          </span>
        </div>
        <div className="workflow-stats">
          <span className="stat">{summary.passed} passed</span>
          <span className="stat">{summary.failed} failed</span>
          {summary.skipped > 0 && <span className="stat">{summary.skipped} skipped</span>}
          <span className="stat">{duration}ms</span>
        </div>
      </div>

      <div className="progress-bar">
        <div
          className="progress-passed"
          style={{ width: `${(summary.passed / summary.total) * 100}%` }}
        />
        <div
          className="progress-failed"
          style={{ width: `${(summary.failed / summary.total) * 100}%` }}
        />
        <div
          className="progress-skipped"
          style={{ width: `${(summary.skipped / summary.total) * 100}%` }}
        />
      </div>

      {Object.keys(variables || {}).length > 0 && (
        <div className="captured-vars">
          <strong>Variables:</strong>
          {Object.entries(variables).map(([key, value]) => (
            <code key={key}>
              {key}={value}
            </code>
          ))}
        </div>
      )}

      <div className="steps-results">
        {steps.map((step) => (
          <div
            key={step.id}
            className={`step-result ${step.passed ? 'passed' : step.skipped ? 'skipped' : 'failed'}`}
          >
            <div className="step-result-header" onClick={() => toggleStep(step.id)}>
              <span className="step-toggle">{expandedSteps[step.id] ? '▼' : '▶'}</span>
              <span className={`step-status ${step.passed ? 'pass' : step.skipped ? 'skip' : 'fail'}`}>
                {step.passed ? '✓' : step.skipped ? '○' : '✗'}
              </span>
              <span className="step-name">{step.name || step.id}</span>
              {step.skipped && <span className="skip-reason">{step.skipReason}</span>}
              {!step.skipped && (
                <>
                  <span className="step-duration">{step.duration}ms</span>
                  <code className="step-exit">exit: {step.exitCode}</code>
                </>
              )}
            </div>

            {expandedSteps[step.id] && !step.skipped && (
              <div className="step-result-body">
                {step.capturedVariables && Object.keys(step.capturedVariables).length > 0 && (
                  <div className="step-section">
                    <strong>Captured:</strong>
                    {Object.entries(step.capturedVariables).map(([key, value]) => (
                      <code key={key}>
                        {key}={value}
                      </code>
                    ))}
                  </div>
                )}

                {step.validations && step.validations.length > 0 && (
                  <div className="step-section">
                    <strong>Validations:</strong>
                    <div className="validations-list">
                      {step.validations.map((v, i) => (
                        <div key={i} className={`validation ${v.passed ? 'passed' : 'failed'}`}>
                          <span className="val-icon">{v.passed ? '✓' : '✗'}</span>
                          <span className="val-type">{v.type}</span>
                          {!v.passed && v.actual !== undefined && (
                            <span className="val-actual">
                              expected: {JSON.stringify(v.expected)}, got: {JSON.stringify(v.actual)}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {step.artifactResults && step.artifactResults.length > 0 && (
                  <div className="step-section">
                    <strong>Artifacts:</strong>
                    <div className="artifacts-list">
                      {step.artifactResults.map((a, i) => (
                        <div key={i} className={`artifact ${a.passed ? 'passed' : 'failed'}`}>
                          <span className="art-icon">{a.passed ? '✓' : '✗'}</span>
                          <code className="art-path">{a.path}</code>
                          {a.error && <span className="art-error">{a.error}</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {step.stdout && (
                  <div className="step-section">
                    <strong>stdout:</strong>
                    <pre className="output">{step.stdout}</pre>
                  </div>
                )}

                {step.stderr && (
                  <div className="step-section">
                    <strong>stderr:</strong>
                    <pre className="output error">{step.stderr}</pre>
                  </div>
                )}

                {step.error && (
                  <div className="step-section">
                    <strong>Error:</strong>
                    <pre className="output error">{step.error}</pre>
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
