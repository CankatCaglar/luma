import type { MonthlyReport } from "@/types";

export function hasDriveReports(reports: MonthlyReport[] | undefined): boolean {
  return Boolean(reports?.some((report) => Boolean(report.driveUrl?.trim())));
}
