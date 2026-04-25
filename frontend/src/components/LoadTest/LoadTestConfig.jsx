import { useState, useRef } from 'react';
import './LoadTestConfig.css';

const defaultConfig = {
  threads: 10,
  rampUp: 10,
  duration: 60,
  loops: '',
  criteria: {
    maxAvgResponseTime: 200,
    maxP95ResponseTime: 500,
    maxErrorRate: 1,
    minThroughput: 50,
  },
};

export function LoadTestConfig({ onRunTest, isRunning, jmeterAvailable }) {
  const [file, setFile] = useState(null);
  const [config, setConfig] = useState(defaultConfig);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);

    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.jmx')) {
      setFile(droppedFile);
      setError(null);
    } else {
      setError('Please upload a .jmx file');
    }
  };

  const handleFileSelect = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      if (selectedFile.name.endsWith('.jmx')) {
        setFile(selectedFile);
        setError(null);
      } else {
        setError('Please upload a .jmx file');
      }
    }
  };

  const handleConfigChange = (field, value) => {
    setConfig((prev) => ({ ...prev, [field]: value }));
  };

  const handleCriteriaChange = (field, value) => {
    setConfig((prev) => ({
      ...prev,
      criteria: { ...prev.criteria, [field]: value },
    }));
  };

  const handleSubmit = () => {
    if (!file) {
      setError('Please upload a JMeter script (.jmx)');
      return;
    }

    setError(null);
    onRunTest(file, {
      threads: parseInt(config.threads, 10) || 10,
      rampUp: parseInt(config.rampUp, 10) || 10,
      duration: parseInt(config.duration, 10) || 60,
      loops: config.loops ? parseInt(config.loops, 10) : undefined,
      criteria: {
        maxAvgResponseTime: config.criteria.maxAvgResponseTime
          ? parseInt(config.criteria.maxAvgResponseTime, 10)
          : undefined,
        maxP95ResponseTime: config.criteria.maxP95ResponseTime
          ? parseInt(config.criteria.maxP95ResponseTime, 10)
          : undefined,
        maxErrorRate: config.criteria.maxErrorRate
          ? parseFloat(config.criteria.maxErrorRate)
          : undefined,
        minThroughput: config.criteria.minThroughput
          ? parseFloat(config.criteria.minThroughput)
          : undefined,
      },
    });
  };

  const clearFile = () => {
    setFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="loadtest-config">
      <h3>Load Test Configuration</h3>

      {!jmeterAvailable && (
        <div className="jmeter-warning">
          JMeter not detected. Please install JMeter and ensure it's in your PATH.
        </div>
      )}

      <div className="config-section">
        <label>JMeter Script</label>
        <div
          className={`file-drop-zone ${dragOver ? 'drag-over' : ''} ${file ? 'has-file' : ''}`}
          onDrop={handleDrop}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => !file && fileInputRef.current?.click()}
        >
          {file ? (
            <div className="file-info">
              <span className="file-name">{file.name}</span>
              <button
                type="button"
                className="clear-file-btn"
                onClick={(e) => { e.stopPropagation(); clearFile(); }}
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <div className="drop-icon">+</div>
              <p>Drop .jmx file here or click to browse</p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".jmx"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />
      </div>

      <div className="config-section">
        <h4>Load Parameters</h4>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="threads">Concurrent Users</label>
            <input
              id="threads"
              type="number"
              value={config.threads}
              onChange={(e) => handleConfigChange('threads', e.target.value)}
              min="1"
              disabled={isRunning}
            />
          </div>
          <div className="form-group">
            <label htmlFor="rampUp">Ramp-up (sec)</label>
            <input
              id="rampUp"
              type="number"
              value={config.rampUp}
              onChange={(e) => handleConfigChange('rampUp', e.target.value)}
              min="0"
              disabled={isRunning}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="duration">Duration (sec)</label>
            <input
              id="duration"
              type="number"
              value={config.duration}
              onChange={(e) => handleConfigChange('duration', e.target.value)}
              min="1"
              disabled={isRunning}
            />
          </div>
          <div className="form-group">
            <label htmlFor="loops">Loops (optional)</label>
            <input
              id="loops"
              type="number"
              value={config.loops}
              onChange={(e) => handleConfigChange('loops', e.target.value)}
              min="1"
              placeholder="Infinite"
              disabled={isRunning}
            />
          </div>
        </div>
      </div>

      <div className="config-section">
        <h4>Acceptance Criteria</h4>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="maxAvgResponseTime">Max Avg Response (ms)</label>
            <input
              id="maxAvgResponseTime"
              type="number"
              value={config.criteria.maxAvgResponseTime}
              onChange={(e) => handleCriteriaChange('maxAvgResponseTime', e.target.value)}
              min="0"
              disabled={isRunning}
            />
          </div>
          <div className="form-group">
            <label htmlFor="maxP95ResponseTime">Max P95 Response (ms)</label>
            <input
              id="maxP95ResponseTime"
              type="number"
              value={config.criteria.maxP95ResponseTime}
              onChange={(e) => handleCriteriaChange('maxP95ResponseTime', e.target.value)}
              min="0"
              disabled={isRunning}
            />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label htmlFor="maxErrorRate">Max Error Rate (%)</label>
            <input
              id="maxErrorRate"
              type="number"
              value={config.criteria.maxErrorRate}
              onChange={(e) => handleCriteriaChange('maxErrorRate', e.target.value)}
              min="0"
              max="100"
              step="0.1"
              disabled={isRunning}
            />
          </div>
          <div className="form-group">
            <label htmlFor="minThroughput">Min Throughput (/sec)</label>
            <input
              id="minThroughput"
              type="number"
              value={config.criteria.minThroughput}
              onChange={(e) => handleCriteriaChange('minThroughput', e.target.value)}
              min="0"
              step="0.1"
              disabled={isRunning}
            />
          </div>
        </div>
      </div>

      {error && <div className="config-error">{error}</div>}

      <button
        type="button"
        className="run-test-btn"
        onClick={handleSubmit}
        disabled={isRunning || !jmeterAvailable}
      >
        {isRunning ? 'Running Test...' : 'Run Load Test'}
      </button>
    </div>
  );
}
