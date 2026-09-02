import { catalogId, foldLabel, parseMonthKey } from "@/lib/asana/map";
import type { DrivePlanFile } from "@/lib/drive/plans";
import { parseDriveResourceId } from "@/lib/drive/parse";
import type { ContentPlan, Job, JobStatus, MonthlyReport } from "@/types";

const PLAN_STATUS_RANK: Record<JobStatus, number> = {
  pending_approval: 4,
  review: 3,
  revision: 2,
  in_progress: 1,
  completed: 0,
};

function monthKey(now: Date): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function sameDriveResource(left?: string, right?: string): boolean {
  const a = left?.trim();
  const b = right?.trim();
  if (!a || !b) return false;
  const leftId = parseDriveResourceId(a);
  const rightId = parseDriveResourceId(b);
  if (leftId && rightId) return leftId === rightId;
  return a === b;
}

function isOffTopicResource(title: string, url: string | undefined, competitorUrl?: string): boolean {
  const folded = foldLabel(title);
  if (folded.includes("rakip analiz") || folded.includes("competitor")) return true;
  if (url && sameDriveResource(url, competitorUrl)) return true;
  return false;
}

function asanaResourceUrl(
  jobs: Job[],
  competitorUrl: string | undefined,
): string | undefined {
  for (const job of jobs) {
    const url = job.resourceUrl?.trim();
    if (!url || isOffTopicResource(job.title, url, competitorUrl)) continue;
    return url;
  }
  return undefined;
}
function pickPrimary(jobs: Job[]): Job {
  return [...jobs].sort(
    (a, b) => PLAN_STATUS_RANK[b.status] - PLAN_STATUS_RANK[a.status],
  )[0];
}

function groupByMonth(jobs: Job[], kind: Job["kind"]): Map<string, Job[]> {
  const groups = new Map<string, Job[]>();
  for (const job of jobs) {
    if (job.kind !== kind) continue;
    const month = parseMonthKey(job.title, job.dueDate);
    const list = groups.get(month) ?? [];
    list.push(job);
    groups.set(month, list);
  }
  return groups;
}

function markCurrent(plans: ContentPlan[], now: Date): ContentPlan[] {
  const currentMonth = monthKey(now);
  const currentYear = String(now.getFullYear());
  const next = plans.map((plan) => ({
    ...plan,
    isCurrent: plan.month === currentMonth,
  }));
  if (!next.some((plan) => plan.isCurrent)) {
    const inYear = next.filter((plan) => plan.month.startsWith(`${currentYear}-`));
    const latestOpen =
      inYear.find((plan) => plan.status !== "completed") ?? inYear[0];
    if (latestOpen) latestOpen.isCurrent = true;
  }
  return next;
}

export function plansFromJobs(jobs: Job[], now: Date): ContentPlan[] {
  const plans = [...groupByMonth(jobs, "plan").entries()]
    .map(([month, monthJobs]) => {
      const primary = pickPrimary(monthJobs);
      return {
        id: catalogId("plan", month),
        month,
        title: primary.title,
        slidesUrl: asanaResourceUrl(monthJobs, undefined),
        dueDate: primary.dueDate,
        status: primary.status,
        isCurrent: false,
      } satisfies ContentPlan;
    })
    .sort((a, b) => b.month.localeCompare(a.month));

  return markCurrent(plans, now);
}

export function mergeContentPlans(
  jobs: Job[],
  drivePlans: DrivePlanFile[] | undefined,
  now: Date,
  competitorUrl?: string,
): ContentPlan[] {
  const asanaPlans = plansFromJobs(jobs, now).map((plan) => {
    const monthJobs = groupByMonth(jobs, "plan").get(plan.month) ?? [];
    return {
      ...plan,
      slidesUrl: asanaResourceUrl(monthJobs, competitorUrl),
    };
  });
  const byMonth = new Map(asanaPlans.map((plan) => [plan.month, plan]));

  for (const drivePlan of drivePlans ?? []) {
    const existing = byMonth.get(drivePlan.month);
    if (existing) {
      byMonth.set(drivePlan.month, {
        ...existing,
        slidesUrl: drivePlan.url,
        title: existing.title || drivePlan.title,
      });
      continue;
    }
    byMonth.set(drivePlan.month, {
      id: catalogId("plan", drivePlan.month),
      month: drivePlan.month,
      title: drivePlan.title,
      slidesUrl: drivePlan.url,
      status: "completed",
      isCurrent: false,
    });
  }

  return markCurrent(
    [...byMonth.values()].sort((left, right) => right.month.localeCompare(left.month)),
    now,
  );
}

export function mergeMonthlyReports(
  jobs: Job[],
  driveReports: DrivePlanFile[] | undefined,
  now: Date,
  competitorUrl?: string,
): MonthlyReport[] {
  const currentMonth = monthKey(now);
  const asanaReports = [...groupByMonth(jobs, "report").entries()].map(([month, monthJobs]) => {
    const primary = pickPrimary(monthJobs);
    return {
      id: catalogId("report", month),
      month,
      title: primary.title,
      driveUrl: asanaResourceUrl(monthJobs, competitorUrl) ?? "",
      updatedAt: primary.completedAt ?? primary.dueDate,
      isNew: month === currentMonth || primary.status !== "completed",
    } satisfies MonthlyReport;
  });
  const byMonth = new Map<string, MonthlyReport>(
    asanaReports.map((report) => [report.month, report]),
  );

  for (const driveReport of driveReports ?? []) {
    const existing = byMonth.get(driveReport.month);
    if (existing) {
      byMonth.set(driveReport.month, {
        ...existing,
        driveUrl: driveReport.url,
        title: existing.title || driveReport.title,
      });
      continue;
    }
    byMonth.set(driveReport.month, {
      id: catalogId("report", driveReport.month),
      month: driveReport.month,
      title: driveReport.title,
      driveUrl: driveReport.url,
      updatedAt: driveReport.modifiedTime,
      isNew: driveReport.month === currentMonth,
    } satisfies MonthlyReport);
  }

  return [...byMonth.values()].sort((left, right) => right.month.localeCompare(left.month));
}

export function reportsFromJobs(jobs: Job[], now: Date): MonthlyReport[] {
  return mergeMonthlyReports(jobs, undefined, now);
}
