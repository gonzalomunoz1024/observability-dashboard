import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { backgroundJobManager } from '../utils/backgroundJobManager';

const BackgroundJobsContext = createContext(null);

const initialState = {
  jobs: {},      // jobId -> job object
  byService: {}, // serviceId -> [jobId, ...]
};

export function BackgroundJobsProvider({ children }) {
  const [state, setState] = useState(initialState);

  // Initialize manager and subscribe to updates
  useEffect(() => {
    backgroundJobManager.initialize();

    const unsubscribe = backgroundJobManager.subscribe((newState) => {
      setState(newState);
    });

    return unsubscribe;
  }, []);

  // Start a background job
  const startJob = useCallback(async (workflow, executableFile, serviceId, config) => {
    return backgroundJobManager.startJob(workflow, executableFile, serviceId, config);
  }, []);

  // Cancel a job
  const cancelJob = useCallback(async (jobId) => {
    return backgroundJobManager.cancelJob(jobId);
  }, []);

  // Remove a completed job
  const removeJob = useCallback((jobId) => {
    backgroundJobManager.removeJob(jobId);
  }, []);

  // Clear all completed jobs
  const clearCompletedJobs = useCallback(() => {
    backgroundJobManager.clearCompletedJobs();
  }, []);

  // Get a specific job
  const getJob = useCallback((jobId) => {
    return backgroundJobManager.getJob(jobId);
  }, []);

  const value = {
    ...state,
    startJob,
    cancelJob,
    removeJob,
    clearCompletedJobs,
    getJob,
  };

  return (
    <BackgroundJobsContext.Provider value={value}>
      {children}
    </BackgroundJobsContext.Provider>
  );
}

// Hook to get all jobs state and actions
export function useBackgroundJobs() {
  const context = useContext(BackgroundJobsContext);
  if (context === null) {
    throw new Error('useBackgroundJobs must be used within a BackgroundJobsProvider');
  }
  return context;
}

// Hook to get jobs for a specific service
export function useServiceJobs(serviceId) {
  const { jobs, byService } = useBackgroundJobs();

  const jobIds = byService[serviceId] || [];
  const serviceJobs = {};

  jobIds.forEach(jobId => {
    if (jobs[jobId]) {
      serviceJobs[jobId] = jobs[jobId];
    }
  });

  return serviceJobs;
}

// Hook to check if a service has running jobs
export function useHasRunningJobs(serviceId) {
  const { jobs, byService } = useBackgroundJobs();

  const jobIds = byService[serviceId] || [];

  return jobIds.some(jobId => jobs[jobId]?.status === 'running');
}

// Hook to get count of running jobs for a service
export function useRunningJobsCount(serviceId) {
  const { jobs, byService } = useBackgroundJobs();

  const jobIds = byService[serviceId] || [];

  return jobIds.filter(jobId => jobs[jobId]?.status === 'running').length;
}
