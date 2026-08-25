import type { PeriodMonths } from "@/types";

export const REFERENCE_NOW = new Date("2026-08-25T12:00:00");

export function isWithinLastMonths(
  isoDate: string,
  months: PeriodMonths,
  now: Date = REFERENCE_NOW,
): boolean {
  const date = new Date(`${isoDate}T00:00:00`);
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setMonth(start.getMonth() - months);
  return date >= start && date <= now;
}

export const PERIOD_OPTIONS: PeriodMonths[] = [1, 3, 6, 12];
