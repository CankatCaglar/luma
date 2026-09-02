import { unstable_noStore as noStore } from "next/cache";
import { AsanaApiError, getBrandTasks } from "@/lib/asana/client";
import { getAsanaEnv } from "@/lib/asana/config";
import { mapJobsToApprovalItems, mapTaskToJob } from "@/lib/asana/map";
import { applyCompetitorOverlay, brandAssetsFromDrive } from "@/lib/drive/assets";
import { loadDrivePlansCatalog, type DrivePlanFile, type DrivePlanYear } from "@/lib/drive/plans";
import type { TenantDriveConfig } from "@/lib/drive/parse";
import { listsFromJobs } from "@/lib/data/jobLists";
import {
  readJobSnapshot,
  snapshotToJobLists,
  writeJobSnapshot,
} from "@/lib/data/jobSnapshot";
import {
  activeJobs as mockActiveJobs,
  brandAssets as mockBrandAssets,
  completedJobs as mockCompletedJobs,
  contentPlans as mockContentPlans,
  dashboardMetrics as mockDashboardMetrics,
  jobs as mockJobs,
  mockTenant,
  monthlyReports as mockMonthlyReports,
  pendingJobs as mockPendingJobs,
} from "@/data/mock";
import { REFERENCE_NOW } from "@/lib/period";
import type { Job, JobLists, TenantSummary } from "@/types";

export type TenantScope = {
  tenantId: string;
  brandName: string;
  brandCode: string;
  email: string;
  projectGids: string[];
  workspaceGid?: string;
  drive?: TenantDriveConfig;
};

export type JobListsLoad = {
  data: JobLists;
  revalidate: (() => Promise<void>) | null;
};

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
    brandAssets: mockBrandAssets,
    referenceNowIso: REFERENCE_NOW.toISOString(),
  };
}

const JOBS_FRESH_MS = 30_000;
const OPEN_TASKS_SINCE = "now";

const jobsCache = new Map<
  string,
  { fetchedAt: number; data: JobLists; partial?: boolean }
>();
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

async function fetchJobLists(
  scope: TenantScope,
  options?: { skipCache?: boolean; openOnly?: boolean },
): Promise<JobLists> {
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
    skipCache: options?.skipCache,
    completedSince: options?.openOnly ? OPEN_TASKS_SINCE : undefined,
  });
  const driveCatalog = await loadDrivePlansCatalog(scope.drive).catch(() => ({
    plansFolderUrl: scope.drive?.plansFolderUrl,
    plansFolderTitle: undefined as string | undefined,
    plans: [] as DrivePlanFile[],
    planYears: [] as DrivePlanYear[],
    logoUrl: scope.drive?.logoUrl,
    briefUrl: scope.drive?.briefUrl,
    competitorUrl: scope.drive?.competitorUrl,
    logoFiles: [],
    briefFiles: [],
    competitorFiles: [],
    reports: [],
  }));
  const competitorUrl = scope.drive?.competitorUrl || driveCatalog.competitorUrl;
  const jobs = applyCompetitorOverlay(
    brandTasks
      .map((task) =>
        mapTaskToJob(task, scope.projectGids[0], {
          brandCode: scope.brandCode,
          statusFieldName: env.statusFieldName,
          kindFieldName: env.kindFieldName,
        }),
      )
      .filter((job): job is Job => job !== null),
    competitorUrl,
  );
  const brandAssets = brandAssetsFromDrive(scope.drive, driveCatalog);

  return listsFromJobs(jobs, "asana", new Date(), toTenantSummary(scope), {
    partial: options?.openOnly,
    brandAssets,
    driveBoxUrl: brandAssets.find((asset) => asset.kind === "box")?.url,
    plansFolderUrl: driveCatalog.plansFolderUrl,
    plansFolderTitle: driveCatalog.plansFolderTitle,
    planYears: driveCatalog.planYears,
    drivePlans: driveCatalog.plans,
    driveReports: driveCatalog.reports,
    competitorUrl,
  });
}

function refreshJobLists(
  scope: TenantScope,
  options?: { skipCache?: boolean; openOnly?: boolean },
): Promise<JobLists> {
  const key = `${cacheKey(scope)}:${options?.openOnly ? "open" : "full"}`;
  const existing = inflight.get(key);
  if (existing && !options?.skipCache) return existing;

  const request = fetchJobLists(scope, options)
    .then((data) => {
      if (!options?.openOnly) {
        jobsCache.set(cacheKey(scope), { fetchedAt: Date.now(), data });
        void writeJobSnapshot(scope.tenantId, data);
      } else {
        const current = jobsCache.get(cacheKey(scope));
        if (!current || current.partial) {
          jobsCache.set(cacheKey(scope), {
            fetchedAt: Date.now(),
            data,
            partial: true,
          });
        }
      }
      return data;
    })
    .finally(() => {
      if (inflight.get(key) === request) inflight.delete(key);
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

function remember(
  scope: TenantScope,
  data: JobLists,
  fetchedAt: number,
  partial?: boolean,
) {
  jobsCache.set(cacheKey(scope), { fetchedAt, data, partial });
}

export async function warmupTenantJobs(scope: TenantScope): Promise<void> {
  jobsCache.delete(cacheKey(scope));
  await refreshJobLists(scope, { skipCache: true }).catch((error) => {
    logAsanaError(error, "tenant warmup failed");
  });
}

export async function getJobLists(input: {
  scope: TenantScope;
  fresh?: boolean;
}): Promise<JobListsLoad> {
  noStore();
  const key = cacheKey(input.scope);
  const fresh = input.fresh ?? false;

  const revalidate = async () => {
    await refreshJobLists(input.scope).catch((error) => {
      logAsanaError(error, "background refresh failed");
    });
  };

  if (!fresh) {
    const cached = jobsCache.get(key);
    if (cached && !cached.partial) {
      const age = Date.now() - cached.fetchedAt;
      return {
        data: cached.data,
        revalidate: age >= JOBS_FRESH_MS ? revalidate : null,
      };
    }

    const snapshot = await readJobSnapshot(input.scope.tenantId);
    const fromSnapshot = snapshot ? snapshotToJobLists(snapshot) : null;
    if (fromSnapshot && snapshot) {
      remember(input.scope, fromSnapshot, snapshot.fetchedAt);
      const age = Date.now() - snapshot.fetchedAt;
      return {
        data: fromSnapshot,
        revalidate: age >= JOBS_FRESH_MS ? revalidate : null,
      };
    }

    if (cached?.partial) {
      return { data: cached.data, revalidate };
    }
  }

  try {
    if (fresh) {
      const data = await refreshJobLists(input.scope, { skipCache: true });
      return { data, revalidate: null };
    }

    const data = await refreshJobLists(input.scope, { openOnly: true });
    return { data, revalidate };
  } catch (error) {
    const cached = jobsCache.get(key);
    if (cached) return { data: cached.data, revalidate: null };
    const snapshot = await readJobSnapshot(input.scope.tenantId);
    const fromSnapshot = snapshot ? snapshotToJobLists(snapshot) : null;
    if (fromSnapshot) {
      remember(input.scope, fromSnapshot, snapshot!.fetchedAt);
      return { data: fromSnapshot, revalidate: null };
    }
    logAsanaError(error, "tenant fetch failed");
    if (process.env.NODE_ENV === "development") {
      return { data: devFallback(input.scope), revalidate: null };
    }
    throw error;
  }
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
