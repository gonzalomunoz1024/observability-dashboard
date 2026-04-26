import { useState } from 'react';
import './SetupCommand.css';

const COMMON_CLIS = [
  { value: 'oc', label: 'OpenShift' },
  { value: 'terraform', label: 'Terraform' },
  { value: 'kubectl', label: 'Kubernetes' },
  { value: 'docker', label: 'Docker' },
  { value: 'helm', label: 'Helm' },
  { value: 'vault', label: 'Vault' },
];

export function SetupCommand({ command, index, onUpdate, onRemove }) {
  const [showInputs, setShowInputs] = useState(false);
  const [isCustomMode, setIsCustomMode] = useState(
    () => !COMMON_CLIS.find(c => c.value === command.executable) && command.executable !== ''
  );

  const handleSelectChange = (value) => {
    if (value === 'custom') {
      setIsCustomMode(true);
      onUpdate({ ...command, executable: '' });
    } else {
      setIsCustomMode(false);
      onUpdate({ ...command, executable: value });
    }
  };

  return (
    <div className="setup-command">
      <div className="setup-command-main">
        <div className="setup-field executable">
          <select
            value={isCustomMode ? 'custom' : command.executable}
            onChange={(e) => handleSelectChange(e.target.value)}
            className="setup-select"
          >
            {COMMON_CLIS.map(cli => (
              <option key={cli.value} value={cli.value}>{cli.label}</option>
            ))}
            <option value="custom">Custom...</option>
          </select>
        </div>

        {isCustomMode && (
          <div className="setup-field custom-name">
            <input
              type="text"
              value={command.executable}
              onChange={(e) => onUpdate({ ...command, executable: e.target.value })}
              placeholder="executable name"
              className="setup-input"
            />
          </div>
        )}

        <div className="setup-field args">
          <input
            type="text"
            value={command.args || ''}
            onChange={(e) => onUpdate({ ...command, args: e.target.value })}
            placeholder="arguments (e.g., login, configure)"
            className="setup-input"
          />
        </div>

        <button
          type="button"
          className={`setup-toggle-btn ${showInputs ? 'active' : ''}`}
          onClick={() => setShowInputs(!showInputs)}
          title="Interactive inputs"
        >
          {command.stdinInputs ? '...' : '+'}
        </button>

        <button
          type="button"
          className="setup-remove-btn"
          onClick={onRemove}
          title="Remove"
        >
          x
        </button>
      </div>

      {showInputs && (
        <div className="setup-command-extra">
          <input
            type="text"
            value={command.stdinInputs || ''}
            onChange={(e) => onUpdate({ ...command, stdinInputs: e.target.value })}
            placeholder="Interactive inputs (one per line, use \n)"
            className="setup-input stdin-input"
          />
        </div>
      )}
    </div>
  );
}

export function SetupCommandsSection({ commands = [], onChange }) {
  const addCommand = () => {
    onChange([...commands, { executable: 'oc', args: '' }]);
  };

  const updateCommand = (index, updated) => {
    const newCommands = [...commands];
    newCommands[index] = updated;
    onChange(newCommands);
  };

  const removeCommand = (index) => {
    onChange(commands.filter((_, i) => i !== index));
  };

  return (
    <div className="setup-commands-section">
      <div className="setup-commands-header">
        <label>Setup Commands</label>
        <span className="setup-hint">Run before tests (e.g., vendor CLI logins)</span>
      </div>

      {commands.length > 0 && (
        <div className="setup-commands-list">
          {commands.map((cmd, index) => (
            <SetupCommand
              key={index}
              command={cmd}
              index={index}
              onUpdate={(updated) => updateCommand(index, updated)}
              onRemove={() => removeCommand(index)}
            />
          ))}
        </div>
      )}

      <button type="button" className="add-setup-btn" onClick={addCommand}>
        + Add Setup Command
      </button>
    </div>
  );
}
