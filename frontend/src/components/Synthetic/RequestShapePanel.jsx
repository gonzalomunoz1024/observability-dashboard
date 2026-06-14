import { useMemo } from 'react';
import './RequestShapePanel.css';

const GENERATORS = [
  { value: 'literal',      label: 'Literal value',  hint: 'use the value in the body as-is' },
  { value: 'uuid',         label: 'UUID',           hint: 'random v4' },
  { value: 'randomInt',    label: 'Random int',     hint: 'inclusive range', args: ['min', 'max'], defaults: ['1', '100'] },
  { value: 'randomString', label: 'Random string',  hint: 'alphanumeric', args: ['length'], defaults: ['8'] },
  { value: 'timestampIso', label: 'Timestamp (ISO)' },
  { value: 'timestampMs',  label: 'Timestamp (ms)'  },
  { value: 'email',        label: 'Email',          hint: 'name@example.com' },
  { value: 'enum',         label: 'Pick from enum', hint: 'one of the schema values' },
];

const GENERATOR_BY_VALUE = Object.fromEntries(GENERATORS.map((g) => [g.value, g]));

function suggestGenerator(field) {
  if (!field) return 'literal';
  if (field.format === 'uuid') return 'uuid';
  if (field.format === 'date-time' || field.format === 'datetime') return 'timestampIso';
  if (field.format === 'email') return 'email';
  if (field.enumValues && field.enumValues.length) return 'enum';
  if (field.type === 'integer' || field.type === 'number') return 'randomInt';
  if (field.type === 'string') return 'randomString';
  return 'literal';
}

function GeneratorArgs({ generator, args, onArgsChange, field }) {
  const spec = GENERATOR_BY_VALUE[generator];
  if (generator === 'enum') {
    const options = field?.enumValues ?? [];
    return (
      <div className="shape-args">
        <span className="args-hint">
          {options.length > 0 ? `${options.length} value${options.length === 1 ? '' : 's'}` : 'no enum on schema'}
        </span>
      </div>
    );
  }
  if (!spec?.args) return null;
  return (
    <div className="shape-args">
      {spec.args.map((label, i) => (
        <label key={label} className="arg-input">
          <span className="arg-label">{label}</span>
          <input
            type="text"
            value={args[i] ?? ''}
            onChange={(e) => {
              const next = [...args];
              next[i] = e.target.value;
              onArgsChange(next);
            }}
            placeholder={spec.defaults?.[i] ?? ''}
          />
        </label>
      ))}
    </div>
  );
}

function TypeBadge({ field }) {
  const label = field.format ? `${field.type} · ${field.format}` : field.type;
  return <span className="shape-type">{label}</span>;
}

export function RequestShapePanel({ fields, dynamicFields, onChange, disabled }) {
  const byPath = useMemo(() => {
    const map = new Map();
    (dynamicFields || []).forEach((df) => map.set(df.path, df));
    return map;
  }, [dynamicFields]);

  if (!fields || fields.length === 0) {
    return (
      <div className="shape-panel shape-panel-empty">
        <div className="shape-head">
          <span className="shape-eyebrow">Request shape</span>
          <span className="shape-hint">
            Pick a start operation from the Swagger panel to populate fields.
          </span>
        </div>
      </div>
    );
  }

  const setGenerator = (field, generator) => {
    const filtered = (dynamicFields || []).filter((df) => df.path !== field.path);
    if (generator === 'literal') {
      onChange(filtered);
      return;
    }
    const spec = GENERATOR_BY_VALUE[generator];
    let args = [];
    if (generator === 'enum') {
      args = field.enumValues || [];
    } else if (spec?.defaults) {
      args = [...spec.defaults];
    }
    onChange([...filtered, { path: field.path, generator, args }]);
  };

  const setArgs = (field, args) => {
    const existing = byPath.get(field.path);
    if (!existing) return;
    const next = (dynamicFields || []).map((df) =>
      df.path === field.path ? { ...df, args } : df);
    onChange(next);
  };

  const dynamicCount = byPath.size;

  return (
    <div className="shape-panel">
      <div className="shape-head">
        <div>
          <span className="shape-eyebrow">Request shape</span>
          <h4 className="shape-title">{fields.length} field{fields.length === 1 ? '' : 's'} from schema</h4>
        </div>
        <span className="shape-summary">
          {dynamicCount === 0
            ? 'All literal'
            : `${dynamicCount} dynamic`}
        </span>
      </div>

      <ul className="shape-list">
        {fields.map((field) => {
          const existing = byPath.get(field.path);
          const generator = existing?.generator ?? 'literal';
          return (
            <li key={field.path} className={`shape-row ${generator !== 'literal' ? 'shape-row-active' : ''}`}>
              <div className="shape-row-info">
                <code className="shape-path">{field.path}</code>
                <TypeBadge field={field} />
                {field.required && <span className="shape-required">required</span>}
              </div>
              <div className="shape-row-controls">
                <select
                  className="shape-generator"
                  value={generator}
                  disabled={disabled}
                  onChange={(e) => setGenerator(field, e.target.value)}
                >
                  {GENERATORS.map((g) => (
                    <option key={g.value} value={g.value}>{g.label}</option>
                  ))}
                </select>
                <GeneratorArgs
                  generator={generator}
                  args={existing?.args ?? []}
                  onArgsChange={(args) => setArgs(field, args)}
                  field={field}
                />
                {generator === 'literal' && (
                  <button
                    type="button"
                    className="shape-suggest"
                    onClick={() => setGenerator(field, suggestGenerator(field))}
                    disabled={disabled}
                    title="Pick a sensible generator based on the schema"
                  >
                    Suggest
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function inferSuggestionForField(field) {
  return suggestGenerator(field);
}
