import { useState, useEffect } from 'react';
import './RunningJobCard.css';

/**
 * RunningJobCard - Displays a running background job in execution history
 */
export function RunningJobCard({ job, onCancel, onExpand }) {
  const [elapsed, setElapsed] = useState(0);

  // Update elapsed time every second
  useEffect(() => {
    const startTime = new Date(job.startedAt).getTime();

    const updateElapsed = () => {
      setElapsed(Math.floor((Date.now() - startTime) / 1000));
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);

    return () => clearInterval(interval);
  }, [job.startedAt]);

  const formatElapsed = (secs) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return mins > 0 ? `${mins}m ${s}s` : `${s}s`;
  };

  const getStatusLabel = () => {
    switch (job.status) {
      case 'running':
        return 'RUNNING';
      case 'interrupted':
        return 'INTERRUPTED';
      case 'cancelled':
        return 'CANCELLED';
      case 'failed':
        return 'FAILED';
      case 'completed':
        return job.result?.passed ? 'PASSED' : 'FAILED';
      default:
        return job.status?.toUpperCase() || 'UNKNOWN';
    }
  };

  const progressPercent = job.progress?.totalSteps > 0
    ? Math.round((job.progress.stepIndex / job.progress.totalSteps) * 100)
    : 0;

  const isRunning = job.status === 'running';
  const isInterrupted = job.status === 'interrupted';
  const isFailed = job.status === 'failed' || job.status === 'cancelled';

  return (
    <div
      className={`running-job-card ${job.status}`}
      onClick={() => onExpand?.(job)}
    >
      <div className="running-job-header">
        <span className={`running-job-status ${job.status}`}>
          {isRunning && <span className="status-spinner" />}
          {getStatusLabel()}
        </span>
        <span className="running-job-name">
          {job.workflowName}
          {job.configName && job.configName !== 'Run 1' && (
            <span className="config-name"> - {job.configName}</span>
          )}
        </span>
        <span className="running-job-elapsed">{formatElapsed(elapsed)}</span>
      </div>

      {/* Progress bar for running jobs */}
      {isRunning && (
        <div className="running-job-progress">
          <div className="progress-bar">
            <div
              className="progress-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="progress-text">
            {job.progress?.stepName
              ? `Step ${job.progress.stepIndex + 1} of ${job.progress.totalSteps}: ${job.progress.stepName}`
              : 'Starting...'}
          </span>
        </div>
      )}

      {/* Error message for interrupted/failed jobs */}
      {(isInterrupted || isFailed) && job.error && (
        <div className="running-job-error">
          {job.error}
        </div>
      )}

      {/* Actions */}
      {isRunning && onCancel && (
        <div className="running-job-actions">
          <button
            className="cancel-job-btn"
            onClick={(e) => {
              e.stopPropagation();
              onCancel(job.id);
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
