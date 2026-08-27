import { catalogId, parseMonthKey } from "@/lib/asana/map";
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

export function plansFromJobs(jobs: Job[], now: Date): ContentPlan[] {
  const currentMonth = monthKey(now);
  const plans = [...groupByMonth(jobs, "plan").entries()]
    .map(([month, monthJobs]) => {
      const primary = pickPrimary(monthJobs);
      return {
        id: catalogId("plan", month),
        month,
        title: primary.title,
        slidesUrl: monthJobs.find((job) => job.resourceUrl)?.resourceUrl,
        status: primary.status,
        isCurrent: month === currentMonth,
      } satisfies ContentPlan;
    })
    .sort((a, b) => b.month.localeCompare(a.month));

  if (!plans.some((plan) => plan.isCurrent) && plans[0]) {
    const latestOpen = plans.find((plan) => plan.status !== "completed") ?? plans[0];
    latestOpen.isCurrent = true;
  }

  return plans;
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
        isNew: month === currentMonth || primary.status !== "completed",
      } satisfies MonthlyReport;
    })
    .sort((a, b) => b.month.localeCompare(a.month));
}
