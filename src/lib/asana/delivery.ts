import type { JobStatus } from "@/types";

export function isApprovalStatus(status: JobStatus | undefined): boolean {
  return status === "pending_approval" || status === "review";
}
