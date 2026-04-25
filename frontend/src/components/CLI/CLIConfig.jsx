import { useState, useRef } from 'react';
import { saveTest } from '../../utils/testStorage';
import './CLIConfig.css';

const defaultTest = {
  name: '',
  args: '',
  expectations: {
    exitCode: 0,
    stdoutContains: '',
    maxDuration: '',
  },
};

export function CLIConfig({ onRunSuite, onTestSaved }) {
  const [executableFile, setExecutableFile] = useState(null);
  const [executableName, setExecutableName] = useState('');
  const [cwd, setCwd] = useState('');
  const [tests, setTests] = useState([{ ...defaultTest }]);
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

  const addTest = () => {
    setTests([...tests, { ...defaultTest }]);
  };

  const removeTest = (index) => {
    setTests(tests.filter((_, i) => i !== index));
  };

  const updateTest = (index, field, value) => {
    const updated = [...tests];
    if (field.startsWith('expectations.')) {
      const expField = field.split('.')[1];
      updated[index] = {
        ...updated[index],
        expectations: {
          ...updated[index].expectations,
          [expField]: value,
        },
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    setTests(updated);
  };

  const handleSaveTest = (index) => {
    const test = tests[index];
    if (!test.name && !test.args) {
      setError('Test name or arguments required to save');
      return;
    }

    const savedTest = saveTest({
      name: test.name || test.args,
      args: test.args,
      cwd: cwd || undefined,
      expectations: {
        exitCode: test.expectations.exitCode !== '' ? parseInt(test.expectations.exitCode, 10) : undefined,
        stdoutContains: test.expectations.stdoutContains || undefined,
        maxDuration: test.expectations.maxDuration ? parseInt(test.expectations.maxDuration, 10) : undefined,
      },
    });

    setError(null);
    onTestSaved?.(savedTest);
  };

  const handleRun = async () => {
    if (!executableFile && !executableName) {
      setError('Please upload an executable to run tests against');
      return;
    }

    const validTests = tests.filter((t) => t.name || t.args);
    if (validTests.length === 0) {
      setError('Please add at least one test case');
      return;
    }

    setIsRunning(true);
    setError(null);

    try {
      const formattedTests = validTests.map((t) => ({
        name: t.name || t.args,
        args: t.args.split(' ').filter(Boolean),
        expectations: {
          exitCode: t.expectations.exitCode !== '' ? parseInt(t.expectations.exitCode, 10) : undefined,
          stdoutContains: t.expectations.stdoutContains
            ? t.expectations.stdoutContains.split(',').map((s) => s.trim())
            : undefined,
          maxDuration: t.expectations.maxDuration
            ? parseInt(t.expectations.maxDuration, 10)
            : undefined,
        },
      }));

      await onRunSuite(executableFile || executableName, formattedTests, { cwd: cwd || undefined });
    } catch (err) {
      setError(err.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="cli-config">
      <h3>CLI Regression Suite</h3>

      <div className="tests-section">
        <div className="tests-header">
          <h4>Test Cases</h4>
          <button type="button" className="add-test-btn" onClick={addTest}>
            + Add Test
          </button>
        </div>

        {tests.map((test, index) => (
          <div key={index} className="test-case">
            <div className="test-case-header">
              <span className="test-number">Test {index + 1}</span>
              <div className="test-case-actions">
                <button
                  type="button"
                  className="save-test-btn"
                  onClick={() => handleSaveTest(index)}
                >
                  Save
                </button>
                {tests.length > 1 && (
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeTest(index)}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>

            <div className="test-case-fields">
              <div className="form-row">
                <div className="form-group">
                  <label>Test Name</label>
                  <input
                    type="text"
                    value={test.name}
                    onChange={(e) => updateTest(index, 'name', e.target.value)}
                    placeholder="e.g., Version check"
                  />
                </div>
                <div className="form-group">
                  <label>Arguments</label>
                  <input
                    type="text"
                    value={test.args}
                    onChange={(e) => updateTest(index, 'args', e.target.value)}
                    placeholder="e.g., --version or help list"
                  />
                </div>
              </div>

              <div className="expectations">
                <span className="expectations-label">Expectations:</span>
                <div className="form-row expectations-row">
                  <div className="form-group small">
                    <label>Exit Code</label>
                    <input
                      type="number"
                      value={test.expectations.exitCode}
                      onChange={(e) => updateTest(index, 'expectations.exitCode', e.target.value)}
                      placeholder="0"
                    />
                  </div>
                  <div className="form-group">
                    <label>Output Contains (comma-separated)</label>
                    <input
                      type="text"
                      value={test.expectations.stdoutContains}
                      onChange={(e) => updateTest(index, 'expectations.stdoutContains', e.target.value)}
                      placeholder="e.g., success, version 1.0"
                    />
                  </div>
                  <div className="form-group small">
                    <label>Max Duration (ms)</label>
                    <input
                      type="number"
                      value={test.expectations.maxDuration}
                      onChange={(e) => updateTest(index, 'expectations.maxDuration', e.target.value)}
                      placeholder="5000"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="run-section">
        <h4>Run Against Executable</h4>

        <div className="form-group">
          <label>Executable</label>
          <div className="executable-selector">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileChange}
              accept=".exe,.sh,.bin,*"
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
          <span className="hint">Upload the CLI executable to test against</span>
        </div>

        <div className="form-group">
          <label htmlFor="cwd">Working Directory (optional)</label>
          <input
            id="cwd"
            type="text"
            value={cwd}
            onChange={(e) => setCwd(e.target.value)}
            placeholder="/path/to/working/directory"
          />
        </div>
      </div>

      {error && <div className="config-error">{error}</div>}

      <button
        type="button"
        className="run-suite-btn"
        onClick={handleRun}
        disabled={isRunning}
      >
        {isRunning ? 'Running...' : 'Run Regression Suite'}
      </button>
    </div>
  );
}
