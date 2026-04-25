import { useState, useEffect } from 'react';
import { LoadTestConfig } from './LoadTestConfig';
import { LoadTestResults } from './LoadTestResults';
import { runLoadTest, checkJMeterAvailable } from '../../utils/loadtest';
import './LoadTestPanel.css';

export function LoadTestPanel() {
  const [results, setResults] = useState([]);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const [jmeterAvailable, setJmeterAvailable] = useState(true);

  useEffect(() => {
    checkJMeterAvailable().then(setJmeterAvailable);
  }, []);

  const handleRunTest = async (file, config) => {
    setIsRunning(true);
    setError(null);

    try {
      const result = await runLoadTest(file, config);
      setResults((prev) => [
        { ...result, timestamp: new Date().toISOString(), fileName: file.name },
        ...prev,
      ].slice(0, 10));
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="loadtest-panel">
      <div className="panel-sidebar">
        <LoadTestConfig
          onRunTest={handleRunTest}
          isRunning={isRunning}
          jmeterAvailable={jmeterAvailable}
        />
      </div>
      <div className="panel-main">
        <div className="results-header">
          <h3>Test Results</h3>
          {results.length > 0 && (
            <button className="clear-btn" onClick={clearResults}>
              Clear All
            </button>
          )}
        </div>

        {error && (
          <div className="panel-error">{error}</div>
        )}

        {isRunning && (
          <div className="running-indicator">
            <div className="spinner" />
            <span>Running load test... This may take a while.</span>
          </div>
        )}

        {!isRunning && results.length === 0 ? (
          <div className="empty-results">
            <p>No test results yet</p>
            <p className="hint">
              Upload a JMeter script (.jmx), configure your test parameters, and click "Run Load Test"
            </p>
          </div>
        ) : (
          <div className="results-list">
            {results.map((result, index) => (
              <div key={index} className="result-item">
                <div className="result-meta">
                  <span className="result-file">{result.fileName}</span>
                  <span className="result-time">
                    {new Date(result.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <LoadTestResults result={result} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
