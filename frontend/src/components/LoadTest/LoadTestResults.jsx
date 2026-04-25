import { useState } from 'react';
import './LoadTestResults.css';

export function LoadTestResults({ result }) {
  const [expanded, setExpanded] = useState(false);

  const { status, metrics, validation, config, executionTime } = result;

  return (
    <div className={`loadtest-result ${status}`}>
      <div className="result-status">
        <span className={`status-badge ${status}`}>
          {status === 'passed' ? 'PASSED' : 'FAILED'}
        </span>
        <span className="execution-time">
          Completed in {(executionTime / 1000).toFixed(1)}s
        </span>
      </div>

      <div className="metrics-grid">
        <div className="metric-item">
          <span className="metric-label">Requests</span>
          <span className="metric-value">{metrics.totalRequests.toLocaleString()}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Success</span>
          <span className="metric-value success">{metrics.successCount.toLocaleString()}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Failed</span>
          <span className="metric-value error">{metrics.failCount.toLocaleString()}</span>
        </div>
        <div className="metric-item">
          <span className="metric-label">Throughput</span>
          <span className="metric-value">{metrics.throughput}/s</span>
        </div>
      </div>

      <div className="validation-section">
        <h4>Acceptance Criteria</h4>
        <div className="validations-list">
          {validation.validations.map((v, index) => (
            <div key={index} className={`validation-item ${v.passed ? 'passed' : 'failed'}`}>
              <span className="validation-icon">{v.passed ? '✓' : '✗'}</span>
              <span className="validation-label">{v.label}</span>
              <span className="validation-actual">{v.actual}</span>
              <span className="validation-expected">{v.expected}</span>
            </div>
          ))}
        </div>
      </div>

      <button
        className="expand-btn"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? 'Hide Details' : 'Show Details'}
      </button>

      {expanded && (
        <div className="details-section">
          <h4>Test Configuration</h4>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Concurrent Users</span>
              <span className="detail-value">{config.threads}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Ramp-up Time</span>
              <span className="detail-value">{config.rampUp}s</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Duration</span>
              <span className="detail-value">{config.duration}s</span>
            </div>
            {config.loops && (
              <div className="detail-item">
                <span className="detail-label">Loops</span>
                <span className="detail-value">{config.loops}</span>
              </div>
            )}
          </div>

          <h4>Response Time Distribution</h4>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Average</span>
              <span className="detail-value">{metrics.avgResponseTime}ms</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">95th Percentile</span>
              <span className="detail-value">{metrics.p95ResponseTime}ms</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Error Rate</span>
              <span className="detail-value">{metrics.errorRate}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
