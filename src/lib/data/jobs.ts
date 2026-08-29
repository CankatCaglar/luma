import { unstable_noStore as noStore } from "next/cache";
import {
  AsanaApiError,
  getBrandTasks,
  getTaskResources,
} from "@/lib/asana/client";
import { getAsanaEnv } from "@/lib/asana/config";
import {
  extractResourceUrl,
  mapJobsToApprovalItems,
  mapTaskToJob,
} from "@/lib/asana/map";
import { plansFromJobs, reportsFromJobs } from "@/lib/data/catalog";
import {
  activeJobs as mockActiveJobs,
  completedJobs as mockCompletedJobs,
  contentPlans as mockContentPlans,
  dashboardMetrics as mockDashboardMetrics,
  jobs as mockJobs,
  mockTenant,
  monthlyReports as mockMonthlyReports,
  pendingJobs as mockPendingJobs,
} from "@/data/mock";
import { isWithinLastMonths, REFERENCE_NOW } from "@/lib/period";
import type {
  DashboardMetrics,
  Job,
  JobLists,
  JobSource,
  TenantSummary,
} from "@/types";

export type TenantScope = {
  tenantId: string;
  brandName: string;
  brandCode: string;
  email: string;
  projectGids: string[];
  workspaceGid?: string;
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

function listsFromJobs(
  jobs: Job[],
  source: JobSource,
  now: Date,
  tenant: TenantSummary,
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
  };
}

function mockJobLists(tenant: TenantSummary): JobLists {
  return {
    tenant,
    source: "mock",
    jobs: mockJobs,
    activeJobs: mockActiveJobs,
    pendingJobs: mockPendingJobs,
    completedJobs: mockCompletedJobs,
    approvalItems: mapJobsToApprovalItems(mockJobs),
    metrics: mockDashboardMetrics,
    contentPlans: mockContentPlans,
    monthlyReports: mockMonthlyReports,
    referenceNowIso: REFERENCE_NOW.toISOString(),
  };
}

const JOBS_FRESH_MS = 60_000;
const JOBS_STALE_MS = 5 * 60_000;

const jobsCache = new Map<string, { fetchedAt: number; data: JobLists }>();
const inflight = new Map<string, Promise<JobLists>>();

function cacheKey(scope: TenantScope): string {
  return `${scope.tenantId}:${scope.brandCode}`;
}

function toTenantSummary(scope: TenantScope): TenantSummary {
  return {
    tenantId: scope.tenantId,
    brandName: scope.brandName,
    brandCode: scope.brandCode,
    email: scope.email,
  };
}

async function fetchJobLists(scope: TenantScope): Promise<JobLists> {
  const env = getAsanaEnv();
  if (!env.accessToken) {
    throw new Error("ASANA_ACCESS_TOKEN is not set");
  }
  if (!scope.projectGids.length || !scope.brandCode) {
    throw new Error("Tenant Asana project or brand config is missing");
  }

  const brandTasks = await getBrandTasks({
    projectGids: scope.projectGids,
    brandCode: scope.brandCode,
    workspaceGid: scope.workspaceGid || env.workspaceGid,
  });
  const jobs = brandTasks
    .map((task) =>
      mapTaskToJob(task, scope.projectGids[0], {
        brandCode: scope.brandCode,
        statusFieldName: env.statusFieldName,
        kindFieldName: env.kindFieldName,
      }),
    )
    .filter((job): job is Job => job !== null);

  const missingResourceIds = jobs
    .filter((job) => !job.resourceUrl && (job.kind === "plan" || job.kind === "report"))
    .map((job) => job.id);
  if (missingResourceIds.length > 0) {
    const resources = await getTaskResources(missingResourceIds);
    for (const job of jobs) {
      const extra = resources.get(job.id);
      if (!extra) continue;
      job.resourceUrl = extractResourceUrl(extra.html_notes, extra.attachments);
    }
  }

  return listsFromJobs(jobs, "asana", new Date(), toTenantSummary(scope));
}

function refreshJobLists(scope: TenantScope): Promise<JobLists> {
  const key = cacheKey(scope);
  const existing = inflight.get(key);
  if (existing) return existing;

  const request = fetchJobLists(scope)
    .then((data) => {
      jobsCache.set(key, { fetchedAt: Date.now(), data });
      return data;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, request);
  return request;
}

function devFallback(scope: TenantScope): JobLists {
  const tenant = toTenantSummary(scope);
  const applied =
    tenant.brandCode === mockTenant.brandCode
      ? tenant
      : {
          ...mockTenant,
          ...tenant,
        };
  return mockJobLists(applied);
}

async function loadJobLists(input: {
  scope: TenantScope;
  fresh?: boolean;
}): Promise<JobLists> {
  noStore();
  const key = cacheKey(input.scope);
  const fresh = input.fresh ?? false;
  const cached = jobsCache.get(key);

  if (cached && Date.now() - cached.fetchedAt < JOBS_STALE_MS) {
    if (fresh || Date.now() - cached.fetchedAt >= JOBS_FRESH_MS) {
      void refreshJobLists(input.scope).catch((error) => {
        logAsanaError(error, "background refresh failed");
      });
    }
    if (!fresh) return cached.data;
  }

  try {
    return await refreshJobLists(input.scope);
  } catch (error) {
    if (cached) return cached.data;
    logAsanaError(error, "tenant fetch failed");
    if (process.env.NODE_ENV === "development") {
      return devFallback(input.scope);
    }
    throw error;
  }
}

export async function getJobLists(input: {
  scope: TenantScope;
  fresh?: boolean;
}): Promise<JobLists> {
  return loadJobLists(input);
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
