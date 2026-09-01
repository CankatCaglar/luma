import { catalogId, parseMonthKey } from "@/lib/asana/map";
import type { DrivePlanFile } from "@/lib/drive/plans";
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
        slidesUrl: monthJobs.find((job) => job.resourceUrl)?.resourceUrl,
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
): ContentPlan[] {
  const asanaPlans = plansFromJobs(jobs, now);
  const byMonth = new Map(asanaPlans.map((plan) => [plan.month, plan]));

  for (const drivePlan of drivePlans ?? []) {
    const existing = byMonth.get(drivePlan.month);
    if (existing) {
      byMonth.set(drivePlan.month, {
        ...existing,
        slidesUrl: drivePlan.url || existing.slidesUrl,
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

export function reportsFromJobs(jobs: Job[], now: Date): MonthlyReport[] {
  const currentMonth = monthKey(now);
  return [...groupByMonth(jobs, "report").entries()]
    .map(([month, monthJobs]) => {
      const primary = pickPrimary(monthJobs);
      return {
        id: catalogId("report", month),
        month,
        title: primary.title,
        driveUrl: monthJobs.find((job) => job.resourceUrl)?.resourceUrl ?? "",
        updatedAt: primary.completedAt ?? primary.dueDate,
        isNew: month === currentMonth || primary.status !== "completed",
      } satisfies MonthlyReport;
    })
    .sort((a, b) => b.month.localeCompare(a.month));
}
