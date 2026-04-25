import { memo, forwardRef } from 'react';
import './Input.css';

/**
 * Input Component
 * Clean, spacious input with clear focus states
 */
export const Input = memo(forwardRef(function Input({
  label,
  hint,
  error,
  type = 'text',
  size = 'md',
  fullWidth = true,
  className = '',
  ...props
}, ref) {
  const wrapperClasses = [
    'input-wrapper',
    fullWidth && 'input-full',
    error && 'input-error',
    className
  ].filter(Boolean).join(' ');

  const inputClasses = [
    'input',
    `input-${size}`
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses}>
      {label && <label className="input-label">{label}</label>}
      <input
        ref={ref}
        type={type}
        className={inputClasses}
        {...props}
      />
      {hint && !error && <span className="input-hint">{hint}</span>}
      {error && <span className="input-error-text">{error}</span>}
    </div>
  );
}));

/**
 * Textarea Component
 */
export const Textarea = memo(forwardRef(function Textarea({
  label,
  hint,
  error,
  rows = 4,
  fullWidth = true,
  className = '',
  ...props
}, ref) {
  const wrapperClasses = [
    'input-wrapper',
    fullWidth && 'input-full',
    error && 'input-error',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses}>
      {label && <label className="input-label">{label}</label>}
      <textarea
        ref={ref}
        rows={rows}
        className="input textarea"
        {...props}
      />
      {hint && !error && <span className="input-hint">{hint}</span>}
      {error && <span className="input-error-text">{error}</span>}
    </div>
  );
}));

/**
 * Select Component
 */
export const Select = memo(forwardRef(function Select({
  label,
  hint,
  error,
  options = [],
  size = 'md',
  fullWidth = true,
  className = '',
  ...props
}, ref) {
  const wrapperClasses = [
    'input-wrapper',
    fullWidth && 'input-full',
    error && 'input-error',
    className
  ].filter(Boolean).join(' ');

  const selectClasses = [
    'input',
    'select',
    `input-${size}`
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClasses}>
      {label && <label className="input-label">{label}</label>}
      <select ref={ref} className={selectClasses} {...props}>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {hint && !error && <span className="input-hint">{hint}</span>}
      {error && <span className="input-error-text">{error}</span>}
    </div>
  );
}));
