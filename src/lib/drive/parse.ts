export type TenantDriveConfig = {
  rootUrl?: string;
  rootFolderId?: string;
  logoUrl?: string;
  briefUrl?: string;
  competitorUrl?: string;
  plansFolderUrl?: string;
  plansFolderId?: string;
  planUrls?: Record<string, string>;
};

export type DriveUrlFields = {
  rootUrl?: string;
  logoUrl?: string;
  briefUrl?: string;
  competitorUrl?: string;
  plansFolderUrl?: string;
  planUrlsText?: string;
};

const ID_PATTERN = /^[a-zA-Z0-9_-]{10,}$/;

function trimOrUndefined(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
}

export function parseDriveResourceId(value: string | undefined | null): string | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  if (ID_PATTERN.test(raw) && !raw.includes("://")) return raw;

  try {
    const url = new URL(raw);
    const folder = url.pathname.match(/\/folders\/([a-zA-Z0-9_-]+)/);
    if (folder?.[1]) return folder[1];
    const file = url.pathname.match(
      /\/(?:file|document|presentation|spreadsheets)\/d\/([a-zA-Z0-9_-]+)/,
    );
    if (file?.[1]) return file[1];
    const id = url.searchParams.get("id")?.trim();
    if (id && ID_PATTERN.test(id)) return id;
  } catch {
    return undefined;
  }

  return undefined;
}

export function driveFolderUrl(id: string): string {
  return `https://drive.google.com/drive/folders/${id}`;
}

export function driveFileViewUrl(id: string): string {
  return `https://drive.google.com/file/d/${id}/view`;
}

export function preferDriveUrl(preferred: string | undefined, fallbackId?: string): string | undefined {
  const url = preferred?.trim();
  if (url) return url;
  return fallbackId ? driveFolderUrl(fallbackId) : undefined;
}

function withDerivedId(url: string | undefined): { url?: string; id?: string } {
  const normalized = trimOrUndefined(url);
  if (!normalized) return {};
  return {
    url: normalized,
    id: parseDriveResourceId(normalized),
  };
}

const MONTH_LINE = /^(20\d{2})[-/.](\d{1,2})\s+/;

export function parsePlanUrlLines(text: string | undefined): Record<string, string> | undefined {
  if (!text?.trim()) return undefined;
  const planUrls: Record<string, string> = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(MONTH_LINE);
    const urlMatch = line.match(/https?:\/\/[^\s]+/i);
    if (!match || !urlMatch) continue;
    const month = `${match[1]}-${String(Number(match[2])).padStart(2, "0")}`;
    planUrls[month] = urlMatch[0];
  }
  return Object.keys(planUrls).length ? planUrls : undefined;
}

export function serializePlanUrlLines(planUrls: Record<string, string> | undefined): string {
  if (!planUrls) return "";
  return Object.entries(planUrls)
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([month, url]) => `${month} ${url}`)
    .join("\n");
}

export function driveConfigFromFields(fields: DriveUrlFields): TenantDriveConfig | undefined {
  const root = withDerivedId(fields.rootUrl);
  const plans = withDerivedId(fields.plansFolderUrl);
  const logoUrl = trimOrUndefined(fields.logoUrl);
  const briefUrl = trimOrUndefined(fields.briefUrl);
  const competitorUrl = trimOrUndefined(fields.competitorUrl);
  const planUrls = parsePlanUrlLines(fields.planUrlsText);

  const config: TenantDriveConfig = {
    rootUrl: root.url,
    rootFolderId: root.id,
    logoUrl,
    briefUrl,
    competitorUrl,
    plansFolderUrl: plans.url,
    plansFolderId: plans.id,
    planUrls,
  };

  return hasDriveConfig(config) ? config : undefined;
}

export function toTenantDrive(input: unknown): TenantDriveConfig | undefined {
  if (!input || typeof input !== "object") return undefined;
  const raw = input as Record<string, unknown>;
  const rootUrl = trimOrUndefined(raw.rootUrl);
  const plansFolderUrl = trimOrUndefined(raw.plansFolderUrl);
  const planUrls =
    raw.planUrls && typeof raw.planUrls === "object" && !Array.isArray(raw.planUrls)
      ? Object.fromEntries(
          Object.entries(raw.planUrls as Record<string, unknown>)
            .map(([month, url]) => [month.trim(), trimOrUndefined(url)] as const)
            .filter((entry): entry is [string, string] => Boolean(entry[1])),
        )
      : undefined;

  const config: TenantDriveConfig = {
    rootUrl,
    rootFolderId: trimOrUndefined(raw.rootFolderId) || parseDriveResourceId(rootUrl),
    logoUrl: trimOrUndefined(raw.logoUrl),
    briefUrl: trimOrUndefined(raw.briefUrl),
    competitorUrl: trimOrUndefined(raw.competitorUrl),
    plansFolderUrl,
    plansFolderId: trimOrUndefined(raw.plansFolderId) || parseDriveResourceId(plansFolderUrl),
    planUrls: planUrls && Object.keys(planUrls).length ? planUrls : undefined,
  };

  return hasDriveConfig(config) ? config : undefined;
}

export function hasDriveConfig(drive: TenantDriveConfig | undefined): boolean {
  if (!drive) return false;
  return Boolean(
    drive.rootUrl ||
      drive.rootFolderId ||
      drive.logoUrl ||
      drive.briefUrl ||
      drive.competitorUrl ||
      drive.plansFolderUrl ||
      drive.plansFolderId ||
      (drive.planUrls && Object.keys(drive.planUrls).length),
  );
}

export function serializeDrive(
  drive: TenantDriveConfig | undefined,
): Record<string, string | Record<string, string> | null> | null {
  if (!hasDriveConfig(drive) || !drive) return null;
  return {
    rootUrl: drive.rootUrl ?? null,
    rootFolderId: drive.rootFolderId ?? null,
    logoUrl: drive.logoUrl ?? null,
    briefUrl: drive.briefUrl ?? null,
    competitorUrl: drive.competitorUrl ?? null,
    plansFolderUrl: drive.plansFolderUrl ?? null,
    plansFolderId: drive.plansFolderId ?? null,
    planUrls: drive.planUrls && Object.keys(drive.planUrls).length ? drive.planUrls : null,
  };
}
