import { cache } from "react";
import { unstable_noStore as noStore } from "next/cache";
import {
  AsanaApiError,
  getTaskResources,
  getTasksForProjects,
} from "@/lib/asana/client";
import { getAsanaEnv, isAsanaConfigured } from "@/lib/asana/config";
import {
  isBrandTask,
  mapJobsToApprovalItems,
  mapTaskKind,
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
import type { DashboardMetrics, Job, JobLists, JobSource } from "@/types";

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

const JOBS_FRESH_MS = 20_000;

let jobsCache: { fetchedAt: number; data: JobLists } | null = null;
let inflight: Promise<JobLists> | null = null;

async function fetchJobLists(): Promise<JobLists> {
  const { projectGids, brandCode, projectGid } = getAsanaEnv();
  if (!projectGids?.length || !brandCode) {
    throw new Error("Asana project or brand is not configured");
  }

  const tasks = await getTasksForProjects(projectGids);
  const brandTasks = tasks.filter((task) => isBrandTask(task, brandCode));
  const resourceGids = brandTasks
    .filter((task) => {
      const kind = mapTaskKind(task);
      return kind === "plan" || kind === "report";
    })
    .map((task) => task.gid);
  const resources = await getTaskResources(resourceGids);
  const jobs = brandTasks
    .map((task) => {
      const extra = resources.get(task.gid);
      return mapTaskToJob(
        extra ? { ...task, ...extra } : task,
        projectGid,
      );
    })
    .filter((job): job is Job => job !== null);
  return listsFromJobs(jobs, "asana", new Date());
}

function refreshJobLists(): Promise<JobLists> {
  if (!inflight) {
    inflight = fetchJobLists()
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

function logAsanaError(error: unknown, label: string) {
  const message =
    error instanceof AsanaApiError
      ? error.message
      : error instanceof Error
        ? error.message
        : "unknown error";
  console.error(`[asana] ${label}: ${message}`);
}

async function loadJobLists(options: { fresh?: boolean } = {}): Promise<JobLists> {
  noStore();

  if (!isAsanaConfigured()) {
    return mockJobLists();
  }

  if (!options.fresh && jobsCache) {
    if (Date.now() - jobsCache.fetchedAt >= JOBS_FRESH_MS) {
      void refreshJobLists().catch((error) => {
        logAsanaError(error, "background refresh failed");
      });
    }
    return jobsCache.data;
  }

  try {
    return await refreshJobLists();
  } catch (error) {
    if (jobsCache) return jobsCache.data;
    logAsanaError(error, "falling back to mock");
    return mockJobLists();
  }
}

export const getJobLists = cache(loadJobLists);
