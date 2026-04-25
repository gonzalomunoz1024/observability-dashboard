import { useState, useRef } from 'react';
import './RunModal.css';

export function RunModal({ testName, onRun, onClose }) {
  const [executableFile, setExecutableFile] = useState(null);
  const [executableName, setExecutableName] = useState('');
  const [cwd, setCwd] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setExecutableFile(file);
      setExecutableName(file.name);
    }
  };

  const clearExecutable = () => {
    setExecutableFile(null);
    setExecutableName('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRun = async () => {
    if (!executableFile) {
      setError('Please upload an executable');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      await onRun(executableFile, { cwd: cwd || undefined });
      onClose();
    } catch (err) {
      setError(err.message);
      setIsRunning(false);
    }
  };

  return (
    <div className="run-modal-overlay" onClick={onClose}>
      <div className="run-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Run Test Suite</h3>
        <p className="run-modal-subtitle">
          Running: <strong>{testName}</strong>
        </p>

        <div className="form-group">
          <label>Executable</label>
          <div className="executable-selector">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              style={{ display: 'none' }}
            />
            {executableName ? (
              <div className="selected-executable">
                <span className="file-name">{executableName}</span>
                <button type="button" className="clear-btn" onClick={clearExecutable}>
                  x
                </button>
              </div>
            ) : (
              <button
                type="button"
                className="upload-executable-btn"
                onClick={() => fileInputRef.current?.click()}
              >
                Upload Executable
              </button>
            )}
          </div>
        </div>

        <div className="form-group">
          <label>Working Directory (optional)</label>
          <input
            type="text"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="/path/to/working/directory"
          />
        </div>

        {error && <div className="run-modal-error">{error}</div>}

        <div className="run-modal-actions">
          <button className="cancel-btn" onClick={onClose} disabled={isRunning}>
            Cancel
          </button>
          <button className="run-btn" onClick={handleRun} disabled={isRunning}>
            {isRunning ? 'Running...' : 'Run Tests'}
          </button>
        </div>
      </div>
    </div>
  );
}
