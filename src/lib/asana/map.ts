import {
  HIDE_NAME_PREFIX,
  HIDE_TAG_NAMES,
  KIND_ALIASES,
  KIND_FIELD_NAMES,
  STATUS_ALIASES,
  STATUS_FIELD_NAMES,
  getAsanaEnv,
  isJobKind,
} from "@/lib/asana/config";
import type {
  AsanaAttachment,
  AsanaCustomField,
  AsanaTag,
  AsanaTask,
} from "@/lib/asana/types";
import type { ApprovalItem, Job, JobKind, JobStatus, JobTag } from "@/types";

type TaskMapOptions = {
  brandCode?: string;
  statusFieldName?: string;
  kindFieldName?: string;
};

const MONTH_INDEX: Record<string, number> = {
  ocak: 1,
  january: 1,
  jan: 1,
  subat: 2,
  february: 2,
  feb: 2,
  mart: 3,
  march: 3,
  mar: 3,
  nisan: 4,
  april: 4,
  apr: 4,
  mayis: 5,
  may: 5,
  haziran: 6,
  june: 6,
  jun: 6,
  temmuz: 7,
  july: 7,
  jul: 7,
  agustos: 8,
  august: 8,
  aug: 8,
  eylul: 9,
  september: 9,
  sep: 9,
  sept: 9,
  ekim: 10,
  october: 10,
  oct: 10,
  kasim: 11,
  november: 11,
  nov: 11,
  aralik: 12,
  december: 12,
  dec: 12,
};

export function foldLabel(value: string): string {
  return value
    .toLocaleLowerCase("tr-TR")
    .replaceAll("ı", "i")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function displayTaskTitle(name: string, brandCode: string): string {
  let title = name.trim().replace(/^\*+\s*/, "");
  const code = brandCode.trim();
  if (code) {
    title = title.replace(new RegExp(escapeRegExp(code), "ig"), " ");
  }
  title = title
    .replace(/[\[\](){}]/g, " ")
    .replace(/[\s]*[-–—|:·]+[\s]*/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
  title = title
    .replace(/^(?:\d+(?:[.,]\d+)?\s*(?:dk|sa|saat)\s*(?:\+\s*)?)+/i, "")
    .trim();
  return title;
}

function normalizedTaskName(name: string): string {
  return name.replace(/[\u200B-\u200D\uFEFF]/g, "").trim();
}

function nameHasHideMarker(name: string): boolean {
  const normalized = normalizedTaskName(name);
  if (normalized.includes(HIDE_NAME_PREFIX)) return true;
  return /[＊∗✱﹡]{2,}/.test(normalized);
}

export function isHiddenTask(task: AsanaTask): boolean {
  if (nameHasHideMarker(task.name ?? "")) return true;

  return (task.tags ?? []).some((tag) => {
    const folded = foldLabel(tag.name);
    if (!folded) return false;
    if (nameHasHideMarker(tag.name)) return true;
    return HIDE_TAG_NAMES.some((alias) => foldLabel(alias) === folded);
  });
}

function isInternalTag(tag: AsanaTag, brandCode: string): boolean {
  const folded = foldLabel(tag.name);
  if (!folded) return true;
  if (nameHasHideMarker(tag.name)) return true;
  if (HIDE_TAG_NAMES.some((alias) => foldLabel(alias) === folded)) return true;
  if (brandCode && folded === foldLabel(brandCode)) return true;
  return false;
}

export function mapTaskTags(task: AsanaTask, brandCode: string): JobTag[] {
  const seen = new Set<string>();
  const tags: JobTag[] = [];
  for (const tag of task.tags ?? []) {
    const name = tag.name.trim();
    if (!name || isInternalTag(tag, brandCode)) continue;
    const key = foldLabel(name);
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push({
      id: tag.gid,
      name,
      color: tag.color?.trim() || undefined,
    });
  }
  return tags;
}

export function parseMonthKey(title: string, fallbackIsoDate: string): string {
  const folded = foldLabel(title);
  const yearMatch = folded.match(/\b(20\d{2})\b/);
  const fallbackYear = fallbackIsoDate.slice(0, 4);
  const fallbackMonth = fallbackIsoDate.slice(5, 7);
  const year = yearMatch?.[1] ?? (fallbackYear || String(new Date().getFullYear()));

  const tokens = folded.split(" ").filter(Boolean);
  for (const token of tokens) {
    const month = MONTH_INDEX[token];
    if (month) return `${year}-${String(month).padStart(2, "0")}`;
  }

  if (fallbackYear && fallbackMonth) return `${fallbackYear}-${fallbackMonth}`;
  return `${year}-01`;
}

export function catalogId(kind: "plan" | "report", month: string): string {
  return `${kind}-${month}`;
}

function unwrapGoogleRedirect(url: string): string {
  try {
    const parsed = new URL(url);
    const nested = parsed.searchParams.get("q");
    if (nested?.startsWith("http") && parsed.hostname.endsWith("google.com")) {
      return nested;
    }
    return url;
  } catch {
    return url;
  }
}

export function toViewerUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const workspace = parsed.pathname.match(
      /^\/(presentation|document|spreadsheets)\/d\/([^/]+)/,
    );
    if (workspace) {
      parsed.pathname = `/${workspace[1]}/d/${workspace[2]}/preview`;
      parsed.search = "";
      parsed.hash = "";
      return parsed.toString();
    }

    const driveFile = parsed.pathname.match(/^\/file\/d\/([^/]+)/);
    if (driveFile) {
      parsed.pathname = `/file/d/${driveFile[1]}/view`;
      parsed.search = parsed.searchParams.get("usp")
        ? `?usp=${parsed.searchParams.get("usp")}`
        : "";
      parsed.hash = "";
      return parsed.toString();
    }

    return url;
  } catch {
    return url;
  }
}

function isGoogleResource(url: string): boolean {
  return /(?:drive|docs|slides)\.google\.com/i.test(url);
}

export function extractResourceUrl(
  htmlNotes?: string,
  attachments?: AsanaAttachment[],
): string | undefined {
  const fromAttachment = attachments?.find((attachment) => {
    const host = attachment.host?.toLowerCase();
    const url = `${attachment.view_url ?? ""} ${attachment.download_url ?? ""}`;
    return host === "gdrive" || isGoogleResource(url);
  });
  if (fromAttachment?.view_url) return toViewerUrl(fromAttachment.view_url);

  if (!htmlNotes) return undefined;

  const decoded = htmlNotes.replaceAll("&amp;", "&").replaceAll("&quot;", '"');
  const matches = decoded.match(/https?:\/\/[^\s"'<>]+/g) ?? [];
  for (const raw of matches) {
    const cleaned = unwrapGoogleRedirect(raw.replace(/[),.;]+$/, ""));
    if (isGoogleResource(cleaned)) return toViewerUrl(cleaned);
  }

  return undefined;
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

function jobHref(taskId: string, status: JobStatus, kind: JobKind, month: string): string {
  if (kind === "plan") return `/planlar/${catalogId("plan", month)}`;
  if (kind === "report") return `/raporlar/${catalogId("report", month)}`;
  if (!taskId) {
    if (status === "pending_approval" || status === "review") return "/isler/onay";
    if (status === "completed") return "/isler/tamamlanan";
    return "/isler/aktif";
  }
  return `/isler/gorev/${taskId}`;
}

function resolveMapOptions(options?: TaskMapOptions): Required<TaskMapOptions> {
  const env = getAsanaEnv();
  return {
    brandCode: options?.brandCode ?? env.brandCode ?? "",
    statusFieldName: options?.statusFieldName ?? env.statusFieldName ?? "",
    kindFieldName: options?.kindFieldName ?? env.kindFieldName ?? "",
  };
}

export function mapTaskStatus(
  task: AsanaTask,
  projectGid?: string,
  options?: TaskMapOptions,
): JobStatus {
  if (task.completed) return "completed";

  const mapOptions = resolveMapOptions(options);
  const statusField = findCustomField(
    task,
    mapOptions.statusFieldName || undefined,
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

export function mapTaskKind(task: AsanaTask, options?: TaskMapOptions): JobKind {
  const mapOptions = resolveMapOptions(options);
  const kindField = findCustomField(
    task,
    mapOptions.kindFieldName || undefined,
    KIND_FIELD_NAMES,
  );
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

function hasBrandCode(task: AsanaTask, code: string): boolean {
  if (foldLabel(task.name).includes(code)) return true;
  return (task.tags ?? []).some((tag) => foldLabel(tag.name).includes(code));
}

export function isBrandTask(task: AsanaTask, brandCode: string): boolean {
  const code = foldLabel(brandCode);
  if (!code) return false;
  if (isHiddenTask(task)) return false;
  if (/\bcore$/.test(foldLabel(task.name))) return false;
  return hasBrandCode(task, code);
}

export function mapTaskToJob(
  task: AsanaTask,
  projectGid?: string,
  options?: TaskMapOptions,
): Job | null {
  if (task.resource_subtype === "milestone") return null;
  if (isHiddenTask(task)) return null;

  const mapOptions = resolveMapOptions(options);
  const brandCode = mapOptions.brandCode ?? "";
  const title = displayTaskTitle(task.name, brandCode);
  if (!title || foldLabel(title) === foldLabel(brandCode)) return null;
  if (nameHasHideMarker(title)) return null;

  const status = mapTaskStatus(task, projectGid, mapOptions);
  const kind = mapTaskKind(task, mapOptions);
  const completedAt =
    status === "completed"
      ? toDateOnly(task.completed_at) ??
        toDateOnly(task.due_on) ??
        toDateOnly(task.created_at)
      : undefined;
  const dueDate =
    toDateOnly(task.due_on) ?? completedAt ?? toDateOnly(task.created_at) ?? "";
  const month = parseMonthKey(title, dueDate);
  const resourceUrl = extractResourceUrl(task.html_notes, task.attachments);

  return {
    id: task.gid,
    title,
    status,
    kind,
    dueDate,
    completedAt,
    href: jobHref(task.gid, status, kind, month),
    resourceUrl,
    tags: mapTaskTags(task, brandCode),
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
      tags: job.tags,
    }));
}
