import type { JobStatus } from "@/types";

export function isInProgressWork(status: JobStatus): boolean {
  return status === "in_progress" || status === "revision";
}

export function canViewDeliverable(status: JobStatus): boolean {
  return !isInProgressWork(status);
}
