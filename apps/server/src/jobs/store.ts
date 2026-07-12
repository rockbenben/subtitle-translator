import { randomUUID } from "node:crypto";
import type { JobError, JobProgress, JobRecord, JobStatus, JobSummary } from "./types.js";

class MemoryJobStore {
  private readonly jobs = new Map<string, JobRecord>();
  private readonly controllers = new Map<string, AbortController>();

  create(type: string): { job: JobRecord; controller: AbortController } {
    const now = new Date().toISOString();
    const job: JobRecord = {
      id: `job_${randomUUID()}`,
      type,
      status: "queued",
      createdAt: now,
      updatedAt: now,
      progress: { current: 0, total: 0, percent: 0 },
    };
    const controller = new AbortController();
    this.jobs.set(job.id, job);
    this.controllers.set(job.id, controller);
    return { job, controller };
  }

  get(id: string): JobRecord | undefined {
    return this.jobs.get(id);
  }

  signal(id: string): AbortSignal | undefined {
    return this.controllers.get(id)?.signal;
  }

  update(id: string, patch: Partial<Omit<JobRecord, "id" | "createdAt">>): JobRecord | undefined {
    const current = this.jobs.get(id);
    if (!current) return undefined;
    const updated = { ...current, ...patch, updatedAt: new Date().toISOString() };
    this.jobs.set(id, updated);
    return updated;
  }

  setStatus(id: string, status: JobStatus): JobRecord | undefined {
    const now = new Date().toISOString();
    return this.update(id, {
      status,
      ...(status === "running" ? { startedAt: now } : {}),
      ...(status === "succeeded" || status === "failed" || status === "cancelled" ? { finishedAt: now } : {}),
    });
  }

  setProgress(id: string, progress: Partial<JobProgress>): JobRecord | undefined {
    const current = this.jobs.get(id);
    if (!current) return undefined;
    const next = { ...current.progress, ...progress };
    const total = Math.max(0, next.total);
    const currentCount = Math.max(0, next.current);
    next.percent = total > 0 ? Math.min(100, Math.round((currentCount / total) * 100)) : next.percent;
    return this.update(id, { progress: next });
  }

  complete(id: string, result: unknown, stats?: unknown): JobRecord | undefined {
    const current = this.jobs.get(id);
    return this.update(id, {
      status: "succeeded",
      finishedAt: new Date().toISOString(),
      progress: { ...current?.progress, current: current?.progress.total ?? 0, percent: 100, total: current?.progress.total ?? 0 },
      result,
      stats,
    });
  }

  fail(id: string, error: JobError): JobRecord | undefined {
    return this.update(id, { status: "failed", finishedAt: new Date().toISOString(), error });
  }

  cancel(id: string): JobRecord | undefined {
    this.controllers.get(id)?.abort();
    return this.update(id, { status: "cancelled", finishedAt: new Date().toISOString() });
  }

  delete(id: string): boolean {
    this.controllers.delete(id);
    return this.jobs.delete(id);
  }

  summary(): JobSummary {
    const counts: JobSummary = { total: this.jobs.size, queued: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0 };
    for (const job of this.jobs.values()) counts[job.status] += 1;
    return counts;
  }
}

export const jobStore = new MemoryJobStore();
