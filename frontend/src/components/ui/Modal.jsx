import { memo, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import './Modal.css';

/**
 * Modal Component
 * Clean overlay with smooth transitions
 */
export const Modal = memo(function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  className = '',
}) {
  // Handle escape key
  const handleEscape = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = '';
    };
  }, [isOpen, handleEscape]);

  if (!isOpen) return null;

  const modalClasses = [
    'modal',
    `modal-${size}`,
    className
  ].filter(Boolean).join(' ');

  return createPortal(
    <div className="modal-overlay" onClick={onClose}>
      <div
        className={modalClasses}
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        {(title || description) && (
          <div className="modal-header">
            {title && <h2 className="modal-title">{title}</h2>}
            {description && <p className="modal-description">{description}</p>}
          </div>
        )}
        <div className="modal-content">
          {children}
        </div>
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M15 5L5 15M5 5l10 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        </button>
      </div>
    </div>,
    document.body
  );
});

/**
 * Modal Actions - Footer with buttons
 */
export const ModalActions = memo(function ModalActions({
  children,
  className = '',
}) {
  return (
    <div className={`modal-actions ${className}`}>
      {children}
    </div>
  );
});
