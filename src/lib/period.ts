import type { PeriodMonths } from "@/types";

export function isWithinLastMonths(
  isoDate: string,
  months: PeriodMonths,
  now: Date = new Date(),
): boolean {
  const date = new Date(`${isoDate}T00:00:00`);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - months);
  return date >= start && date <= now;
}

export const PERIOD_OPTIONS: PeriodMonths[] = [1, 3, 6, 12];
