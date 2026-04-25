import { memo } from 'react';
import './Card.css';

/**
 * Card Component
 * Minimal surface with subtle elevation
 */
export const Card = memo(function Card({
  children,
  variant = 'default',
  padding = 'md',
  hover = false,
  onClick,
  className = '',
  ...props
}) {
  const classes = [
    'card',
    `card-${variant}`,
    `card-padding-${padding}`,
    hover && 'card-hover',
    onClick && 'card-clickable',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick} {...props}>
      {children}
    </div>
  );
});

/**
 * Card Header
 */
export const CardHeader = memo(function CardHeader({
  children,
  className = '',
  ...props
}) {
  return (
    <div className={`card-header ${className}`} {...props}>
      {children}
    </div>
  );
});

/**
 * Card Title
 */
export const CardTitle = memo(function CardTitle({
  children,
  className = '',
  ...props
}) {
  return (
    <h3 className={`card-title ${className}`} {...props}>
      {children}
    </h3>
  );
});

/**
 * Card Description
 */
export const CardDescription = memo(function CardDescription({
  children,
  className = '',
  ...props
}) {
  return (
    <p className={`card-description ${className}`} {...props}>
      {children}
    </p>
  );
});

/**
 * Card Content
 */
export const CardContent = memo(function CardContent({
  children,
  className = '',
  ...props
}) {
  return (
    <div className={`card-content ${className}`} {...props}>
      {children}
    </div>
  );
});

/**
 * Card Footer
 */
export const CardFooter = memo(function CardFooter({
  children,
  className = '',
  ...props
}) {
  return (
    <div className={`card-footer ${className}`} {...props}>
      {children}
    </div>
  );
});
