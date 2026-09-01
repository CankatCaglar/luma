import { mapJobsToApprovalItems } from "@/lib/asana/map";
import { plansFromJobs, reportsFromJobs } from "@/lib/data/catalog";
import { isWithinLastMonths } from "@/lib/period";
import type { DashboardMetrics, Job, JobLists, JobSource, TenantSummary } from "@/types";

export type CompactJobLists = {
  tenant: TenantSummary;
  source: JobSource;
  jobs: Job[];
  referenceNowIso: string;
  partial?: boolean;
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

export function metricsFromJobs(jobs: Job[], now: Date): DashboardMetrics {
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

export function listsFromJobs(
  jobs: Job[],
  source: JobSource,
  now: Date,
  tenant: TenantSummary,
  extra?: { partial?: boolean },
): JobLists {
  return {
    tenant,
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
    partial: extra?.partial,
  };
}

export function compactJobLists(data: JobLists): CompactJobLists {
  return {
    tenant: data.tenant,
    source: data.source,
    jobs: data.jobs,
    referenceNowIso: data.referenceNowIso,
    partial: data.partial,
  };
}

export function expandJobLists(data: CompactJobLists): JobLists | null {
  if (!data?.tenant?.brandName || !Array.isArray(data.jobs)) return null;
  const now = data.referenceNowIso ? new Date(data.referenceNowIso) : new Date();
  if (Number.isNaN(now.getTime())) return null;
  return listsFromJobs(
    data.jobs,
    data.source === "mock" ? "mock" : "asana",
    now,
    data.tenant,
    { partial: data.partial },
  );
}
