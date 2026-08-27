import { cache } from "react";
import { unstable_cache } from "next/cache";
import { AsanaApiError, getTasksForProjects } from "@/lib/asana/client";
import { getAsanaEnv, isAsanaConfigured } from "@/lib/asana/config";
import {
  isBrandTask,
  mapJobsToApprovalItems,
  mapTaskToJob,
} from "@/lib/asana/map";
import { plansFromJobs, reportsFromJobs } from "@/lib/data/catalog";
import {
  activeJobs as mockActiveJobs,
  approvalItems as mockApprovalItems,
  completedJobs as mockCompletedJobs,
  contentPlans as mockContentPlans,
  dashboardMetrics as mockDashboardMetrics,
  jobs as mockJobs,
  monthlyReports as mockMonthlyReports,
  pendingJobs as mockPendingJobs,
} from "@/data/mock";
import { isWithinLastMonths, REFERENCE_NOW } from "@/lib/period";
import type {
  ApprovalItem,
  ContentPlan,
  DashboardMetrics,
  Job,
  MonthlyReport,
} from "@/types";

export type JobSource = "asana" | "mock";

export type JobLists = {
  source: JobSource;
  jobs: Job[];
  activeJobs: Job[];
  pendingJobs: Job[];
  completedJobs: Job[];
  approvalItems: ApprovalItem[];
  metrics: DashboardMetrics;
  contentPlans: ContentPlan[];
  monthlyReports: MonthlyReport[];
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
    contentPlans: plansFromJobs(jobs, now),
    monthlyReports: reportsFromJobs(jobs, now),
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
    contentPlans: mockContentPlans,
    monthlyReports: mockMonthlyReports,
    referenceNowIso: REFERENCE_NOW.toISOString(),
  };
}

const JOBS_FRESH_MS = 5 * 60_000;
const JOBS_STALE_MS = 30 * 60_000;

let jobsCache: { fetchedAt: number; data: JobLists } | null = null;
let inflight: Promise<JobLists> | null = null;

async function fetchJobLists(): Promise<JobLists> {
  const { projectGids, brandCode, projectGid } = getAsanaEnv();
  if (!projectGids?.length || !brandCode) {
    throw new Error("Asana project or brand is not configured");
  }

  const tasks = await getTasksForProjects(projectGids);
  const jobs = tasks
    .filter((task) => isBrandTask(task, brandCode))
    .map((task) => mapTaskToJob(task, projectGid))
    .filter((job): job is Job => job !== null);
  return listsFromJobs(jobs, "asana", new Date());
}

const fetchCachedJobLists = unstable_cache(
  async () => fetchJobLists(),
  ["asana-job-lists"],
  { revalidate: 300 },
);

function refreshJobLists(): Promise<JobLists> {
  if (!inflight) {
    inflight = fetchCachedJobLists()
      .then((data) => {
        jobsCache = { fetchedAt: Date.now(), data };
        return data;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

async function loadJobLists(): Promise<JobLists> {
  if (!isAsanaConfigured()) {
    return mockJobLists();
  }

  const now = Date.now();
  if (jobsCache) {
    const age = now - jobsCache.fetchedAt;
    if (age < JOBS_FRESH_MS) return jobsCache.data;
    if (age < JOBS_STALE_MS) {
      void refreshJobLists().catch((error) => {
        const message =
          error instanceof AsanaApiError
            ? error.message
            : error instanceof Error
              ? error.message
              : "unknown error";
        console.error(`[asana] background refresh failed: ${message}`);
      });
      return jobsCache.data;
    }
  }

  try {
    return await refreshJobLists();
  } catch (error) {
    if (jobsCache) return jobsCache.data;
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
