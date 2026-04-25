import { memo } from 'react';
import './StatusIndicator.css';

/**
 * StatusIndicator - Status badge
 * Minimal status display with dot and label
 */
export const StatusIndicator = memo(function StatusIndicator({ status }) {
  return (
    <span className={`status-indicator status-${status}`} title={status}>
      <span className="status-dot" />
      <span className="status-text">{status}</span>
    </span>
  );
});
