import { memo, forwardRef } from 'react';
import './Button.css';

/**
 * Button Component
 * Minimal, purposeful button with variants
 */
export const Button = memo(forwardRef(function Button({
  children,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  fullWidth = false,
  type = 'button',
  className = '',
  onClick,
  ...props
}, ref) {
  const classes = [
    'btn',
    `btn-${variant}`,
    `btn-${size}`,
    fullWidth && 'btn-full',
    loading && 'btn-loading',
    className
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {loading && <span className="btn-spinner" />}
      <span className="btn-content">{children}</span>
    </button>
  );
}));
