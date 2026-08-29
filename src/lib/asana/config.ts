import type { JobKind, JobStatus } from "@/types";

export const ASANA_API_BASE = "https://app.asana.com/api/1.0";

export const TASK_LIST_OPT_FIELDS = [
  "name",
  "completed",
  "completed_at",
  "due_on",
  "created_at",
  "resource_subtype",
  "memberships.project.gid",
  "memberships.section.name",
  "custom_fields.name",
  "custom_fields.display_value",
  "custom_fields.enum_value.name",
  "custom_fields.text_value",
  "custom_fields.resource_subtype",
  "tags.name",
  "tags.color",
  "attachments.host",
  "attachments.view_url",
].join(",");

export const TASK_OPT_FIELDS = [
  TASK_LIST_OPT_FIELDS,
  "html_notes",
].join(",");

export const TASK_RESOURCE_FIELDS = [
  "html_notes",
  "attachments.host",
  "attachments.view_url",
].join(",");

export const HIDE_NAME_PREFIX = "**";

export const HIDE_TAG_NAMES = [
  "gizli",
  "hidden",
  "internal",
  "dahili",
  "hide",
  "luma hide",
];

export const PROJECT_OPT_FIELDS = [
  "name",
  "gid",
  "permalink_url",
  "custom_field_settings.custom_field.name",
  "custom_field_settings.custom_field.gid",
  "custom_field_settings.custom_field.resource_subtype",
  "custom_field_settings.custom_field.enum_options.name",
  "custom_field_settings.custom_field.enum_options.gid",
].join(",");

export type AsanaEnv = {
  accessToken: string;
  workspaceGid: string;
  projectGid: string;
  projectGids: string[];
  brandCode: string;
  statusFieldName: string | undefined;
  kindFieldName: string | undefined;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function parseGids(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(/[,\s]+/).map((part) => part.trim()).filter(Boolean))];
}

export function getAsanaEnv(): Partial<AsanaEnv> {
  const projectGids = parseGids(readEnv("ASANA_PROJECT_GID"));
  return {
    accessToken: readEnv("ASANA_ACCESS_TOKEN"),
    workspaceGid: readEnv("ASANA_WORKSPACE_GID"),
    projectGid: projectGids[0],
    projectGids,
    brandCode: readEnv("ASANA_BRAND_CODE")?.toUpperCase(),
    statusFieldName: readEnv("ASANA_STATUS_FIELD"),
    kindFieldName: readEnv("ASANA_KIND_FIELD"),
  };
}

export function isAsanaConfigured(): boolean {
  const env = getAsanaEnv();
  return Boolean(
    env.accessToken &&
      env.workspaceGid &&
      env.projectGids &&
      env.projectGids.length > 0 &&
      env.brandCode,
  );
}

export function requireAsanaToken(): string {
  const token = getAsanaEnv().accessToken;
  if (!token) {
    throw new Error("ASANA_ACCESS_TOKEN is not set");
  }
  return token;
}

export const STATUS_FIELD_NAMES = ["durum", "status", "statu"];
export const KIND_FIELD_NAMES = ["tur", "tip", "kind", "type", "is turu"];

export const STATUS_ALIASES: Record<string, JobStatus> = {
  "onay bekliyor": "pending_approval",
  "pending approval": "pending_approval",
  "client approval": "pending_approval",
  "waiting approval": "pending_approval",
  "waiting for approval": "pending_approval",
  "musteri onayi": "pending_approval",
  onay: "pending_approval",
  inceleme: "review",
  review: "review",
  "in review": "review",
  hatirlatma: "review",
  revizyon: "revision",
  revision: "revision",
  revize: "revision",
  "devam ediyor": "in_progress",
  "in progress": "in_progress",
  "uretimdeki": "in_progress",
  "uretim kontrol": "in_progress",
  "brief kontrol": "in_progress",
  iletim: "in_progress",
  aktif: "in_progress",
  doing: "in_progress",
  tamamlanan: "completed",
  tamamlandi: "completed",
  arsiv: "completed",
  completed: "completed",
  done: "completed",
};

export const KIND_ALIASES: [string, JobKind][] = [
  ["icerik plan", "plan"],
  ["content plan", "plan"],
  ["google ads", "ads"],
  ["web site", "website"],
  ["website", "website"],
  ["plan", "plan"],
  ["video", "video"],
  ["reklam", "ads"],
  ["ads", "ads"],
  ["blog", "blog"],
  ["rapor", "report"],
  ["report", "report"],
  ["fotograf", "photo"],
  ["photo", "photo"],
  ["cekimi", "photo"],
  ["tasarim", "design"],
  ["design", "design"],
  ["web", "website"],
  ["icerik", "content"],
  ["content", "content"],
];

const JOB_KINDS = new Set<JobKind>([
  "plan",
  "website",
  "video",
  "ads",
  "blog",
  "report",
  "photo",
  "content",
  "design",
]);

export function isJobKind(value: string): value is JobKind {
  return JOB_KINDS.has(value as JobKind);
}
