/**
 * BackgroundJobManager - Singleton that manages background CLI job execution
 * Lives outside React lifecycle to persist SSE connections when modal closes
 */

import { formatWorkflowForExecution } from './workflowFormatter';
import { uploadExecutable, cancelWorkflow } from './cli';

const PROXY_URL = process.env.REACT_APP_PROXY_URL || 'http://localhost:3001';
const SESSION_STORAGE_KEY = 'background-jobs';

class BackgroundJobManager {
  constructor() {
    this.activeJobs = new Map(); // jobId -> { streamId, reader, metadata, abortController }
    this.listeners = new Set();  // Callback functions for state updates
    this.initialized = false;
  }

  // Initialize and recover any interrupted jobs
  initialize() {
    if (this.initialized) return;
    this.initialized = true;
    this.handleRecovery();
  }

  // Subscribe to job updates
  subscribe(callback) {
    this.listeners.add(callback);
    // Immediately notify with current state
    callback(this.getJobsState());
    return () => this.listeners.delete(callback);
  }

  // Notify all listeners of state change
  notifyListeners() {
    const state = this.getJobsState();
    this.listeners.forEach(callback => callback(state));
  }

  // Get current jobs state for context
  getJobsState() {
    const jobs = {};
    const byService = {};

    this.activeJobs.forEach((job, jobId) => {
      jobs[jobId] = job.metadata;
      const serviceId = job.metadata.serviceId;
      if (!byService[serviceId]) {
        byService[serviceId] = [];
      }
      byService[serviceId].push(jobId);
    });

    return { jobs, byService };
  }

  // Start a new background job
  async startJob(workflow, executableFile, serviceId, config) {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      // Upload executable first
      const uploadResult = await uploadExecutable(executableFile);
      const executablePath = uploadResult.path;

      // Format workflow for execution
      const formatted = formatWorkflowForExecution(workflow, executablePath, config.variables || {});

      // Create job metadata
      const metadata = {
        id: jobId,
        serviceId,
        workflowId: workflow.id,
        workflowName: workflow.name,
        configName: config.name,
        status: 'running',
        progress: {
          currentStep: null,
          stepName: null,
          stepIndex: 0,
          totalSteps: workflow.steps?.length || 0,
          stepStatus: 'pending',
        },
        startedAt: new Date().toISOString(),
        completedAt: null,
        result: null,
        error: null,
        executablePath,
        config,
        liveOutput: {}, // stepId -> { stdout, stderr }
      };

      // Store job
      this.activeJobs.set(jobId, {
        streamId: null,
        reader: null,
        metadata,
        abortController: new AbortController(),
      });

      // Save to session storage for recovery
      this.saveToSessionStorage();
      this.notifyListeners();

      // Start the streaming execution
      this.executeJob(jobId, formatted);

      return jobId;
    } catch (error) {
      // Clean up on error
      this.activeJobs.delete(jobId);
      throw error;
    }
  }

  // Execute job with SSE streaming
  async executeJob(jobId, workflow) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    try {
      const response = await fetch(`${PROXY_URL}/api/cli/workflow/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(workflow),
        signal: job.abortController.signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get streamId for cancellation
      const streamId = response.headers.get('X-Stream-Id');
      job.streamId = streamId;
      this.saveToSessionStorage();

      const reader = response.body.getReader();
      job.reader = reader;
      const decoder = new TextDecoder();
      let buffer = '';

      const processEvents = async () => {
        try {
          const { done, value } = await reader.read();

          if (done) {
            return;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          let currentEvent = null;
          let currentData = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7);
            } else if (line.startsWith('data: ')) {
              currentData = line.slice(6);
              if (currentEvent && currentData) {
                try {
                  const data = JSON.parse(currentData);
                  this.handleEvent(jobId, currentEvent, data);
                } catch (e) {
                  console.warn('Failed to parse SSE data:', e);
                }
              }
              currentEvent = null;
              currentData = '';
            }
          }

          // Continue reading
          await processEvents();
        } catch (err) {
          if (err.name !== 'AbortError') {
            this.handleJobError(jobId, err.message);
          }
        }
      };

      await processEvents();
    } catch (err) {
      if (err.name !== 'AbortError') {
        this.handleJobError(jobId, err.message);
      }
    }
  }

  // Handle SSE events
  handleEvent(jobId, event, data) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    switch (event) {
      case 'start':
        job.metadata.progress.totalSteps = data.totalSteps || job.metadata.progress.totalSteps;
        break;

      case 'stepStart':
        job.metadata.progress.currentStep = data.stepId;
        job.metadata.progress.stepName = data.name;
        job.metadata.progress.stepStatus = 'running';
        // Initialize live output for this step
        job.metadata.liveOutput[data.stepId] = { stdout: '', stderr: '' };
        break;

      case 'output':
        if (job.metadata.liveOutput[data.stepId]) {
          if (data.type === 'stdout') {
            job.metadata.liveOutput[data.stepId].stdout += data.data;
          } else if (data.type === 'stderr') {
            job.metadata.liveOutput[data.stepId].stderr += data.data;
          }
        }
        break;

      case 'stepComplete':
        job.metadata.progress.stepIndex++;
        job.metadata.progress.stepStatus = data.result?.passed ? 'passed' : 'failed';
        break;

      case 'complete':
        job.metadata.status = data.passed ? 'completed' : 'failed';
        job.metadata.completedAt = new Date().toISOString();
        job.metadata.result = data;
        // Clean up
        this.cleanupJob(jobId);
        break;

      case 'error':
        this.handleJobError(jobId, data.message);
        return;

      default:
        break;
    }

    this.saveToSessionStorage();
    this.notifyListeners();
  }

  // Handle job error
  handleJobError(jobId, errorMessage) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    job.metadata.status = 'failed';
    job.metadata.completedAt = new Date().toISOString();
    job.metadata.error = errorMessage;

    this.cleanupJob(jobId);
    this.saveToSessionStorage();
    this.notifyListeners();
  }

  // Clean up job resources (but keep metadata for history)
  cleanupJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    // Close reader if open
    if (job.reader) {
      try {
        job.reader.cancel();
      } catch (e) {
        // Ignore
      }
    }

    // Keep metadata but clear active resources
    job.reader = null;
    job.streamId = null;
  }

  // Cancel a running job
  async cancelJob(jobId) {
    const job = this.activeJobs.get(jobId);
    if (!job) return;

    // Abort fetch
    job.abortController.abort();

    // Cancel on server if we have streamId
    if (job.streamId) {
      try {
        await cancelWorkflow(job.streamId);
      } catch (e) {
        console.warn('Failed to cancel workflow on server:', e);
      }
    }

    job.metadata.status = 'cancelled';
    job.metadata.completedAt = new Date().toISOString();

    this.cleanupJob(jobId);
    this.saveToSessionStorage();
    this.notifyListeners();
  }

  // Remove a completed/failed job from tracking
  removeJob(jobId) {
    this.activeJobs.delete(jobId);
    this.saveToSessionStorage();
    this.notifyListeners();
  }

  // Get a specific job
  getJob(jobId) {
    const job = this.activeJobs.get(jobId);
    return job?.metadata || null;
  }

  // Check if service has running jobs
  hasRunningJobs(serviceId) {
    for (const [, job] of this.activeJobs) {
      if (job.metadata.serviceId === serviceId && job.metadata.status === 'running') {
        return true;
      }
    }
    return false;
  }

  // Save to session storage for recovery
  saveToSessionStorage() {
    try {
      const jobs = [];
      this.activeJobs.forEach((job) => {
        jobs.push({
          ...job.metadata,
          streamId: job.streamId,
        });
      });
      sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(jobs));
    } catch (e) {
      console.warn('Failed to save jobs to session storage:', e);
    }
  }

  // Load from session storage
  loadFromSessionStorage() {
    try {
      const data = sessionStorage.getItem(SESSION_STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  // Handle page refresh recovery
  handleRecovery() {
    const savedJobs = this.loadFromSessionStorage();

    for (const jobData of savedJobs) {
      if (jobData.status === 'running') {
        // Mark as interrupted - SSE connection was lost
        jobData.status = 'interrupted';
        jobData.completedAt = new Date().toISOString();
        jobData.error = 'Browser was refreshed while job was running. Final status is unknown.';
      }

      // Restore to activeJobs map (for display purposes)
      if (jobData.status !== 'completed') {
        this.activeJobs.set(jobData.id, {
          streamId: null,
          reader: null,
          metadata: jobData,
          abortController: new AbortController(),
        });
      }
    }

    this.saveToSessionStorage();
    this.notifyListeners();
  }

  // Clear all completed/failed jobs
  clearCompletedJobs() {
    const toRemove = [];
    this.activeJobs.forEach((job, jobId) => {
      if (job.metadata.status !== 'running') {
        toRemove.push(jobId);
      }
    });
    toRemove.forEach(jobId => this.activeJobs.delete(jobId));
    this.saveToSessionStorage();
    this.notifyListeners();
  }
}

// Export singleton instance
export const backgroundJobManager = new BackgroundJobManager();
