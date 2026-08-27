import { cache } from "react";
import { AsanaApiError, getTasksForProjects } from "@/lib/asana/client";
import { getAsanaEnv, isAsanaConfigured } from "@/lib/asana/config";
import {
  isBrandTask,
  mapJobsToApprovalItems,
  mapTaskToJob,
} from "@/lib/asana/map";
import {
  activeJobs as mockActiveJobs,
  approvalItems as mockApprovalItems,
  completedJobs as mockCompletedJobs,
  dashboardMetrics as mockDashboardMetrics,
  jobs as mockJobs,
  pendingJobs as mockPendingJobs,
} from "@/data/mock";
import { isWithinLastMonths, REFERENCE_NOW } from "@/lib/period";
import type { ApprovalItem, DashboardMetrics, Job } from "@/types";

export type JobSource = "asana" | "mock";

export type JobLists = {
  source: JobSource;
  jobs: Job[];
  activeJobs: Job[];
  pendingJobs: Job[];
  completedJobs: Job[];
  approvalItems: ApprovalItem[];
  metrics: DashboardMetrics;
  referenceNowIso: string;
};

function isActive(job: Job): boolean {
  return job.status === "in_progress" || job.status === "revision";
}

function isPending(job: Job): boolean {
  return job.status === "pending_approval" || job.status === "review";
}

function isCompleted(job: Job): boolean {
  return job.status === "completed" && Boolean(job.completedAt);
}

function metricsFromJobs(jobs: Job[], now: Date): DashboardMetrics {
  return {
    pendingApproval: jobs.filter(isPending).length,
    activeJobs: jobs.filter(isActive).length,
    completedThisMonth: jobs.filter(
      (job) =>
        isCompleted(job) &&
        job.completedAt &&
        isWithinLastMonths(job.completedAt, 1, now),
    ).length,
  };
}

function listsFromJobs(jobs: Job[], source: JobSource, now: Date): JobLists {
  return {
    source,
    jobs,
    activeJobs: jobs.filter(isActive),
    pendingJobs: jobs.filter(isPending),
    completedJobs: jobs
      .filter(isCompleted)
      .sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    approvalItems: mapJobsToApprovalItems(jobs),
    metrics: metricsFromJobs(jobs, now),
    referenceNowIso: now.toISOString(),
  };
}

function mockJobLists(): JobLists {
  return {
    source: "mock",
    jobs: mockJobs,
    activeJobs: mockActiveJobs,
    pendingJobs: mockPendingJobs,
    completedJobs: mockCompletedJobs,
    approvalItems: mockApprovalItems,
    metrics: mockDashboardMetrics,
    referenceNowIso: REFERENCE_NOW.toISOString(),
  };
}

const JOBS_TTL_MS = 60_000;
let jobsCache: { expiresAt: number; data: JobLists } | null = null;

async function loadJobLists(): Promise<JobLists> {
  if (jobsCache && jobsCache.expiresAt > Date.now()) {
    return jobsCache.data;
  }

  if (!isAsanaConfigured()) {
    return mockJobLists();
  }

  const { projectGids, brandCode, projectGid } = getAsanaEnv();
  if (!projectGids?.length || !brandCode) {
    return mockJobLists();
  }

  try {
    const tasks = await getTasksForProjects(projectGids);
    const jobs = tasks
      .filter((task) => isBrandTask(task, brandCode))
      .map((task) => mapTaskToJob(task, projectGid))
      .filter((job): job is Job => job !== null);
    const data = listsFromJobs(jobs, "asana", new Date());
    jobsCache = { expiresAt: Date.now() + JOBS_TTL_MS, data };
    return data;
  } catch (error) {
    const message =
      error instanceof AsanaApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "unknown error";
    console.error(`[asana] falling back to mock: ${message}`);
    return mockJobLists();
  }
}

export const getJobLists = cache(loadJobLists);
