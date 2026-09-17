import { foldLabel, hasLumaOnayMarker, matchStatus } from "@/lib/asana/map";
import type { JobKind } from "@/types";
import type { DeliveryEventType } from "@/lib/delivery/types";

export type SectionRole = "iletim" | "day4" | "approval" | "revision" | "other";

export function classifySectionRole(sectionName: string | undefined): SectionRole {
  if (!sectionName) return "other";
  const folded = foldLabel(sectionName);
  if (!folded) return "other";
  if (folded === "iletim" || folded.includes("iletim")) return "iletim";
  if (folded.includes("4 gun") || /\b4\s*gun\b/.test(folded)) return "day4";
  const status = matchStatus(sectionName);
  if (status === "revision") return "revision";
  if (status === "pending_approval" || status === "review") return "approval";
  return "other";
}

export function isCustomerHandoff(from: SectionRole, to: SectionRole): boolean {
  return from === "iletim" && (to === "day4" || to === "approval");
}

export function isRevisionHandoff(from: SectionRole, to: SectionRole): boolean {
  return from === "revision" && (to === "day4" || to === "approval");
}

export function classifyDeliveryEvent(input: {
  fromSection?: string;
  toSection: string;
  taskName: string;
  kind: JobKind;
}): DeliveryEventType | null {
  const from = classifySectionRole(input.fromSection);
  const to = classifySectionRole(input.toSection);
  const customer = isCustomerHandoff(from, to);
  const revision = isRevisionHandoff(from, to);
  if (!customer && !revision) return null;

  if (hasLumaOnayMarker(input.taskName)) return "approval_requested";
  if (revision) return "revision_done";
  if (input.kind === "plan") return "plan_ready";
  if (input.kind === "report") return "report_ready";
  return "work_ready";
}
