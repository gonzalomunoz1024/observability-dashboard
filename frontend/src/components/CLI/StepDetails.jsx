import { cleanCliOutput } from '../../utils/outputCleaner';
import './StepDetails.css';

/**
 * Shared component for displaying step execution details
 * Used by both RunModal (live runs) and CLIResults (execution history)
 */
export function StepDetails({ step, result, captures = {} }) {
  if (!result) return null;

  // Determine if this is an HTTP step
  const isHttp = step?.type === 'http' || result?.type === 'http' || result?.http;

  // Get values from various possible locations in the result
  const stdout = result?.stdout || result?.output || result?.standardOutput || result?.out || '';
  const stderr = result?.stderr || result?.standardError || result?.err || '';
  const exitCode = result?.exitCode ?? result?.exit_code ?? result?.code;
  const validations = result?.validation?.validations || result?.validations || [];
  const args = result?.args || step?.args;

  // Try to pretty print JSON
  const formatJsonOutput = (output) => {
    if (!output) return null;
    try {
      const parsed = JSON.parse(output);
      const pretty = JSON.stringify(parsed, null, 2);
      const lines = pretty.split('\n');
      return {
        formatted: lines.map((line, i) => `${String(i + 1).padStart(3, ' ')} | ${line}`).join('\n'),
        lineCount: lines.length,
        isJson: true
      };
    } catch {
      return { formatted: output, lineCount: output.split('\n').length, isJson: false };
    }
  };

  return (
    <div className="step-details">
      {/* Command or HTTP Request */}
      {isHttp && (result?.http?.url || step?.http?.url) && (
        <div className="detail-section">
          <h5>Request</h5>
          <code>{result?.http?.method || step?.http?.method || 'GET'} {result?.http?.url || step?.http?.url}</code>
        </div>
      )}
      {!isHttp && args && (
        <div className="detail-section">
          <h5>Command</h5>
          <code>{Array.isArray(args) ? args.join(' ') : args}</code>
        </div>
      )}

      {/* Exit Code / Status Code + Duration */}
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

      {/* Captured Variables */}
      {Object.keys(captures).length > 0 && (
        <div className="detail-section">
          <h5>Captured Variables</h5>
          <div className="captured-vars-list">
            {Object.entries(captures).map(([varName, value]) => (
              <div key={varName} className="captured-var-item">
                <span className="captured-var-name">{varName}</span>
                <span className="captured-var-equals">=</span>
                <code className="captured-var-value">{value}</code>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
