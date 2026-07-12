export type JobStatus = "queued" | "running" | "succeeded" | "failed" | "cancelled";

export type JobProgress = {
  current: number;
  total: number;
  percent: number;
  message?: string;
};

export type JobError = {
  code?: string;
  message: string;
  status?: number;
};

export type JobRecord = {
  id: string;
  type: string;
  status: JobStatus;
  createdAt: string;
  updatedAt: string;
  startedAt?: string;
  finishedAt?: string;
  progress: JobProgress;
  stats?: unknown;
  error?: JobError;
  result?: unknown;
};

export type JobSummary = {
  total: number;
  queued: number;
  running: number;
  succeeded: number;
  failed: number;
  cancelled: number;
};
