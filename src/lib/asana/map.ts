import {
  KIND_ALIASES,
  KIND_FIELD_NAMES,
  STATUS_ALIASES,
  STATUS_FIELD_NAMES,
  getAsanaEnv,
  isJobKind,
} from "@/lib/asana/config";
import type { AsanaCustomField, AsanaTask } from "@/lib/asana/types";
import type { ApprovalItem, Job, JobKind, JobStatus } from "@/types";

const IMAGE_NAME = /\.(avif|gif|jpe?g|png|svg|webp)$/i;

export function foldLabel(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matchStatus(label: string | undefined): JobStatus | undefined {
  if (!label) return undefined;
  const folded = foldLabel(label);
  const exact = STATUS_ALIASES[folded];
  if (exact) return exact;
  const aliases = Object.entries(STATUS_ALIASES).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [alias, status] of aliases) {
    if (alias.length >= 5 && folded.includes(alias)) return status;
  }
  return undefined;
}

const STATUS_PRIORITY: JobStatus[] = [
  "completed",
  "pending_approval",
  "review",
  "revision",
  "in_progress",
];

function strongestStatus(statuses: JobStatus[]): JobStatus | undefined {
  for (const status of STATUS_PRIORITY) {
    if (statuses.includes(status)) return status;
  }
  return statuses[0];
}

function matchKind(label: string | undefined): JobKind | undefined {
  if (!label) return undefined;
  const folded = foldLabel(label);
  if (isJobKind(folded)) return folded;
  for (const [alias, kind] of KIND_ALIASES) {
    if (folded === alias || folded.includes(alias)) return kind;
  }
  return undefined;
}

function fieldMatches(
  field: AsanaCustomField,
  configuredName: string | undefined,
  aliases: string[],
): boolean {
  const folded = foldLabel(field.name);
  if (configuredName && folded === foldLabel(configuredName)) return true;
  return aliases.includes(folded);
}

function customFieldValue(field: AsanaCustomField | undefined): string | undefined {
  if (!field) return undefined;
  return (
    field.enum_value?.name ??
    field.text_value ??
    field.display_value ??
    undefined
  )?.trim() || undefined;
}

function findCustomField(
  task: AsanaTask,
  configuredName: string | undefined,
  aliases: string[],
): AsanaCustomField | undefined {
  return task.custom_fields?.find((field) =>
    fieldMatches(field, configuredName, aliases),
  );
}

export function taskSectionName(task: AsanaTask, projectGid: string): string | undefined {
  const match = task.memberships?.find(
    (membership) => membership.project?.gid === projectGid,
  );
  return match?.section?.name ?? task.memberships?.[0]?.section?.name;
}

function toDateOnly(value: string | null | undefined): string | undefined {
  if (!value) return undefined;
  return value.slice(0, 10);
}

function thumbnailUrl(task: AsanaTask): string | undefined {
  const image = task.attachments?.find((attachment) =>
    attachment.name ? IMAGE_NAME.test(attachment.name) : false,
  );
  return image?.view_url ?? image?.download_url ?? undefined;
}

function jobHref(status: JobStatus, kind: JobKind): string {
  if (kind === "plan") return "/planlar";
  if (kind === "report") return "/raporlar";
  if (status === "pending_approval" || status === "review") return "/isler/onay";
  if (status === "completed") return "/isler/tamamlanan";
  return "/isler/aktif";
}

export function mapTaskStatus(task: AsanaTask, projectGid?: string): JobStatus {
  if (task.completed) return "completed";

  const env = getAsanaEnv();
  const statusField = findCustomField(
    task,
    env.statusFieldName,
    STATUS_FIELD_NAMES,
  );
  const fromField = matchStatus(customFieldValue(statusField));
  if (fromField && fromField !== "completed") return fromField;

  const sectionLabels = (task.memberships ?? [])
    .map((membership) => membership.section?.name)
    .filter((name): name is string => Boolean(name));
  const preferred = projectGid ? taskSectionName(task, projectGid) : undefined;
  if (preferred) sectionLabels.unshift(preferred);

  const fromSections = sectionLabels
    .map((label) => matchStatus(label))
    .filter((status): status is JobStatus => Boolean(status));
  const fromSection = strongestStatus(fromSections);
  if (fromSection) return fromSection;

  const fromName = matchStatus(task.name);
  if (fromName && fromName !== "completed") return fromName;

  return "in_progress";
}

export function mapTaskKind(task: AsanaTask): JobKind {
  const env = getAsanaEnv();
  const kindField = findCustomField(task, env.kindFieldName, KIND_FIELD_NAMES);
  const fromField = matchKind(customFieldValue(kindField));
  if (fromField) return fromField;

  for (const tag of task.tags ?? []) {
    const fromTag = matchKind(tag.name);
    if (fromTag) return fromTag;
  }

  const fromName = matchKind(task.name);
  if (fromName) return fromName;

  return "content";
}

export function isBrandTask(task: AsanaTask, brandCode: string): boolean {
  const code = foldLabel(brandCode);
  if (!code) return false;
  const foldedName = foldLabel(task.name);
  if (!foldedName.includes(code)) return false;
  if (/\bcore$/.test(foldedName)) return false;
  return true;
}

export function mapTaskToJob(
  task: AsanaTask,
  projectGid?: string,
): Job | null {
  if (task.resource_subtype === "milestone") return null;

  const status = mapTaskStatus(task, projectGid);
  const kind = mapTaskKind(task);
  const completedAt =
    status === "completed"
      ? toDateOnly(task.completed_at) ??
        toDateOnly(task.due_on) ??
        toDateOnly(task.created_at)
      : undefined;
  const dueDate =
    toDateOnly(task.due_on) ?? completedAt ?? toDateOnly(task.created_at) ?? "";

  return {
    id: task.gid,
    title: task.name.trim() || "Untitled",
    status,
    kind,
    dueDate,
    completedAt,
    href: jobHref(status, kind),
    thumbnailUrl: thumbnailUrl(task),
  };
}

export function mapJobsToApprovalItems(jobs: Job[]): ApprovalItem[] {
  return jobs
    .filter(
      (job): job is Job & { status: "pending_approval" | "review" } =>
        job.status === "pending_approval" || job.status === "review",
    )
    .map((job) => ({
      id: job.id,
      title: job.title,
      kind: job.kind,
      status: job.status,
      dueDate: job.dueDate,
      href: job.href,
      thumbnailUrl: job.thumbnailUrl,
    }));
}
