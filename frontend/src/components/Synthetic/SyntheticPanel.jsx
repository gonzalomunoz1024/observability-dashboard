import { useState } from 'react';
import { SyntheticForm } from './SyntheticForm';
import { TraceViewer } from './TraceViewer';
import './SyntheticPanel.css';

export function SyntheticPanel() {
  const [results, setResults] = useState([]);

  const handleResult = (result) => {
    setResults((prev) => [result, ...prev].slice(0, 10));
  };

  const clearResults = () => {
    setResults([]);
  };

  return (
    <div className="synthetic-panel">
      <div className="panel-sidebar">
        <SyntheticForm onResult={handleResult} />
      </div>
      <div className="panel-main">
        <div className="results-header">
          <h3>Results</h3>
          {results.length > 0 && (
            <button className="clear-btn" onClick={clearResults}>
              Clear All
            </button>
          )}
        </div>
        {results.length === 0 ? (
          <div className="empty-results">
            <p>No synthetic transactions yet</p>
            <p className="hint">
              Inject a synthetic event to trace its flow through your system
            </p>
          </div>
        ) : (
          <div className="results-list">
            {results.map((result, index) => (
              <TraceViewer key={index} result={result} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
