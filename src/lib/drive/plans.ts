import { foldLabel, parseMonthFromLabel } from "@/lib/asana/map";
import {
  DriveApiError,
  getDriveFile,
  isDriveConfigured,
  listDriveChildren,
  type DriveFile,
} from "@/lib/drive/client";
import { driveFileViewUrl, driveFolderUrl, type TenantDriveConfig } from "@/lib/drive/parse";
import type { BrandFile } from "@/types";

const FOLDER_MIME = "application/vnd.google-apps.folder";
const SHORTCUT_MIME = "application/vnd.google-apps.shortcut";
const PRESENTATION_MIME = "application/vnd.google-apps.presentation";
const DOCUMENT_MIME = "application/vnd.google-apps.document";
const MAX_ROOT_FOLDERS = 12;
const MAX_DEEP_FOLDERS = 8;

export type DrivePlanFile = {
  month: string;
  title: string;
  url: string;
  modifiedTime?: string;
};

export type DrivePlanYear = {
  year: string;
  title: string;
  url: string;
};

export type DrivePlansCatalog = {
  plansFolderUrl?: string;
  plansFolderTitle?: string;
  planYears?: DrivePlanYear[];
  plans: DrivePlanFile[];
  logoUrl?: string;
  briefUrl?: string;
  competitorUrl?: string;
  logoFiles?: BrandFile[];
  briefFiles?: BrandFile[];
  competitorFiles?: BrandFile[];
  reports?: DrivePlanFile[];
};

function yearFromName(name: string | undefined): string | undefined {
  return name?.match(/\b(20\d{2})\b/)?.[1];
}

function looksLikeReport(name: string): boolean {
  const folded = foldLabel(name);
  return folded.includes("rapor") || folded.includes("report");
}

function looksLikeSocialMedia(name: string): boolean {
  const folded = foldLabel(name);
  return folded === "sosyal medya" || folded === "social media";
}

function looksLikeContentPlanFolder(name: string): boolean {
  if (looksLikeCompetitor(name) || looksLikeReport(name)) return false;
  const folded = foldLabel(name);
  if (folded.includes("icerik plan") || folded.includes("content plan")) return true;
  if (folded.includes("sosyal medya plan")) return true;
  if (folded.includes("content calendar") || folded.includes("editorial")) return true;
  if (folded === "planlar" || folded === "plans") return true;
  return looksLikeSocialMedia(name);
}

function looksLikeReportsFolder(name: string): boolean {
  if (looksLikeCompetitor(name) || looksLikeContentPlanFolder(name)) return false;
  const folded = foldLabel(name);
  return folded.includes("rapor") || folded.includes("report");
}

function looksLikeLogo(name: string): boolean {
  return foldLabel(name).includes("logo");
}

function looksLikeBrief(name: string): boolean {
  const folded = foldLabel(name);
  if (folded.includes("brand brief")) return true;
  return folded.includes("brief") && !folded.includes("management");
}

function looksLikeCompetitor(name: string): boolean {
  const folded = foldLabel(name);
  return folded.includes("rakip analiz") || folded.includes("competitor");
}

function looksLikeIdentity(name: string): boolean {
  const folded = foldLabel(name);
  return (
    folded.includes("kurumsal kimlik") ||
    folded.includes("brand kit") ||
    folded.includes("identity") ||
    folded.includes("marka kimlik")
  );
}

function shouldGoDeeper(name: string): boolean {
  const folded = foldLabel(name);
  return (
    looksLikeLogo(name) ||
    looksLikeBrief(name) ||
    looksLikeContentPlanFolder(name) ||
    looksLikeCompetitor(name) ||
    looksLikeIdentity(name) ||
    looksLikeSocialMedia(name) ||
    folded.includes("strateji") ||
    folded.includes("strategy") ||
    folded.includes("dijital") ||
    folded.includes("sosyal medya") ||
    folded.includes("social media")
  );
}

function isLogoishFile(file: DriveFile): boolean {
  if (file.mimeType.startsWith("image/")) return true;
  if (looksLikeLogo(file.name)) return true;
  return /\.(png|svg|pdf|ai|eps|jpg|jpeg|webp)$/i.test(file.name);
}

function fileUrl(file: DriveFile): string {
  if (file.webViewLink) return file.webViewLink;
  if (file.mimeType === FOLDER_MIME) return driveFolderUrl(file.id);
  return driveFileViewUrl(file.id);
}

function driveDownloadUrl(file: DriveFile): string | undefined {
  if (file.webContentLink) return file.webContentLink;
  if (file.mimeType.startsWith("application/vnd.google-apps.")) return undefined;
  return `https://drive.google.com/uc?export=download&id=${file.id}`;
}

function toBrandFile(file: DriveFile): BrandFile {
  return {
    id: file.id,
    name: file.name,
    mimeType: file.mimeType,
    size: file.size,
    width: file.width,
    height: file.height,
    modifiedTime: file.modifiedTime,
    viewUrl: fileUrl(file),
    downloadUrl: driveDownloadUrl(file),
  };
}

function pickNamedAsset(files: DriveFile[], match: (name: string) => boolean): string | undefined {
  const hits = files.filter((file) => match(file.name));
  if (!hits.length) return undefined;
  const preferred =
    hits.find((file) => file.mimeType === FOLDER_MIME) ??
    hits.find((file) => file.mimeType === PRESENTATION_MIME || file.mimeType === DOCUMENT_MIME) ??
    hits[0];
  return fileUrl(preferred);
}

function looksLikeNoiseName(name: string): boolean {
  return (
    looksLikeCompetitor(name) ||
    looksLikeLogo(name) ||
    looksLikeBrief(name) ||
    looksLikeIdentity(name)
  );
}

function isBareYearFolder(file: DriveFile): boolean {
  return file.mimeType === FOLDER_MIME && /^20\d{2}$/.test(file.name.trim());
}

function rankMime(mimeType: string): number {
  if (mimeType === FOLDER_MIME) return 5;
  if (mimeType === PRESENTATION_MIME) return 4;
  if (mimeType === DOCUMENT_MIME) return 3;
  return 2;
}

async function resolveShortcut(file: DriveFile): Promise<DriveFile> {
  if (file.mimeType !== SHORTCUT_MIME || !file.shortcutTargetId) return file;
  try {
    const target = await getDriveFile(file.shortcutTargetId);
    return {
      ...target,
      name: file.name || target.name,
    };
  } catch {
    return {
      ...file,
      id: file.shortcutTargetId,
      mimeType: file.shortcutTargetMimeType ?? file.mimeType,
    };
  }
}

async function listResolved(folderId: string): Promise<DriveFile[]> {
  const children = await listDriveChildren(folderId);
  return Promise.all(children.map(resolveShortcut));
}

async function walkDriveIndex(rootId: string): Promise<DriveFile[]> {
  const root = await listResolved(rootId);
  const all = [...root];
  const rootFolders = root.filter((file) => file.mimeType === FOLDER_MIME).slice(0, MAX_ROOT_FOLDERS);
  const nested = await Promise.all(
    rootFolders.map(async (folder) => {
      try {
        return await listResolved(folder.id);
      } catch {
        return [] as DriveFile[];
      }
    }),
  );
  for (const kids of nested) all.push(...kids);

  const rootFolderIds = new Set(rootFolders.map((folder) => folder.id));
  const deeperFolders = all
    .filter(
      (file) =>
        file.mimeType === FOLDER_MIME &&
        !rootFolderIds.has(file.id) &&
        shouldGoDeeper(file.name),
    )
    .slice(0, MAX_DEEP_FOLDERS);
  const deeper = await Promise.all(
    deeperFolders.map(async (folder) => {
      try {
        return await listResolved(folder.id);
      } catch {
        return [] as DriveFile[];
      }
    }),
  );
  for (const kids of deeper) all.push(...kids);
  return all;
}

function pickBetter(
  current: DrivePlanFile | undefined,
  next: DrivePlanFile,
  mimeType: string,
  currentMime?: string,
): DrivePlanFile {
  if (!current) return next;
  if (rankMime(mimeType) > rankMime(currentMime ?? "")) return next;
  if ((next.modifiedTime ?? "") > (current.modifiedTime ?? "")) return next;
  return current;
}

async function plansFromChildren(
  children: DriveFile[],
  fallbackYear?: string,
  mode: "plan" | "report" = "plan",
): Promise<DrivePlanFile[]> {
  const byMonth = new Map<string, { plan: DrivePlanFile; mimeType: string }>();

  for (const file of children) {
    if (looksLikeNoiseName(file.name)) continue;
    if (mode === "plan" && looksLikeReport(file.name)) continue;
    if (mode === "report" && looksLikeContentPlanFolder(file.name)) continue;
    if (mode === "report" && !looksLikeReport(file.name) && file.mimeType !== FOLDER_MIME) {
      const folded = foldLabel(file.name);
      if (!parseMonthFromLabel(file.name, fallbackYear)) continue;
      if (!folded.includes("rapor") && !folded.includes("report")) continue;
    }
    const month = parseMonthFromLabel(file.name, fallbackYear);
    if (!month) continue;
    const plan: DrivePlanFile = {
      month,
      title: file.name,
      url: fileUrl(file),
      modifiedTime: file.modifiedTime,
    };
    const current = byMonth.get(month);
    const winner = pickBetter(current?.plan, plan, file.mimeType, current?.mimeType);
    byMonth.set(month, {
      plan: winner,
      mimeType: winner === plan ? file.mimeType : (current?.mimeType ?? file.mimeType),
    });
  }

  return [...byMonth.values()]
    .map((entry) => entry.plan)
    .sort((left, right) => right.month.localeCompare(left.month));
}

function mergePlanLists(...lists: DrivePlanFile[][]): DrivePlanFile[] {
  const byMonth = new Map<string, DrivePlanFile>();
  for (const list of lists) {
    for (const plan of list) byMonth.set(plan.month, plan);
  }
  return [...byMonth.values()].sort((left, right) => right.month.localeCompare(left.month));
}

function yearsFromPlans(plans: DrivePlanFile[]): DrivePlanYear[] {
  const years = [...new Set(plans.map((plan) => plan.month.slice(0, 4)))].filter((year) =>
    /^20\d{2}$/.test(year),
  );
  return years
    .sort((left, right) => right.localeCompare(left))
    .map((year) => ({ year, title: year, url: "" }));
}

async function plansFromFolder(
  folder: {
    id: string;
    name?: string;
    url?: string;
  },
  mode: "plan" | "report" = "plan",
): Promise<{
  folder: { id: string; name?: string; url?: string };
  years: DrivePlanYear[];
  plans: DrivePlanFile[];
}> {
  const children = await listResolved(folder.id);
  const yearFolders = children.filter(
    (file) => file.mimeType === FOLDER_MIME && yearFromName(file.name),
  );
  const yearFolderIds = new Set(yearFolders.map((file) => file.id));
  const listed = yearFolders.length
    ? []
    : await plansFromChildren(
        children.filter((file) => !yearFolderIds.has(file.id)),
        yearFromName(folder.name),
        mode,
      );

  const nested = await Promise.all(
    yearFolders.map(async (yearFolder) => {
      const year = yearFromName(yearFolder.name);
      if (!year) return null;
      try {
        const yearKids = await listResolved(yearFolder.id);
        const plans = await plansFromChildren(yearKids, year, mode);
        return {
          year,
          title: year,
          url: fileUrl(yearFolder),
          plans,
        };
      } catch {
        return {
          year,
          title: year,
          url: fileUrl(yearFolder),
          plans: [] as DrivePlanFile[],
        };
      }
    }),
  );

  const yearEntries = nested.filter(
    (entry): entry is { year: string; title: string; url: string; plans: DrivePlanFile[] } =>
      Boolean(entry),
  );
  const allPlans = mergePlanLists(listed, ...yearEntries.map((entry) => entry.plans));
  const years = [
    ...yearEntries.map(({ year, title, url }) => ({ year, title, url })),
    ...yearsFromPlans(listed).filter(
      (item) => !yearEntries.some((entry) => entry.year === item.year),
    ),
  ].sort((left, right) => right.year.localeCompare(left.year));

  if (!years.length && allPlans.length) {
    return { folder, years: yearsFromPlans(allPlans), plans: allPlans };
  }

  return { folder, years, plans: allPlans };
}

async function findNamedFolder(
  indexed: DriveFile[],
  match: (name: string) => boolean,
): Promise<{ id: string; name?: string; url?: string } | null> {
  const folders = indexed.filter(
    (file) => file.mimeType === FOLDER_MIME && match(file.name),
  );
  if (!folders.length) return null;

  const currentYear = String(new Date().getFullYear());
  const preferred =
    folders.find((folder) => yearFromName(folder.name) === currentYear) ??
    [...folders].sort((left, right) =>
      (yearFromName(right.name) ?? "").localeCompare(yearFromName(left.name) ?? ""),
    )[0];

  return { id: preferred.id, name: preferred.name, url: fileUrl(preferred) };
}

async function findPlansFolder(
  drive: TenantDriveConfig,
  indexed: DriveFile[],
): Promise<{ id: string; name?: string; url?: string } | null> {
  if (drive.plansFolderId) {
    try {
      const file = await getDriveFile(drive.plansFolderId);
      return { id: file.id, name: file.name, url: fileUrl(file) };
    } catch {
      return {
        id: drive.plansFolderId,
        url: drive.plansFolderUrl ?? driveFolderUrl(drive.plansFolderId),
      };
    }
  }

  const named = await findNamedFolder(indexed, looksLikeContentPlanFolder);
  if (named) return named;
  return null;
}

async function collectBareYearPlans(
  indexed: DriveFile[],
  mode: "plan" | "report" = "plan",
): Promise<{ years: DrivePlanYear[]; plans: DrivePlanFile[] } | null> {
  const yearFolders = indexed.filter(isBareYearFolder);
  if (!yearFolders.length) return null;

  const nested = await Promise.all(
    yearFolders.map(async (yearFolder) => {
      const year = yearFromName(yearFolder.name);
      if (!year) return null;
      try {
        const kids = await listResolved(yearFolder.id);
        const plans = await plansFromChildren(kids, year, mode);
        if (!plans.length) return null;
        return {
          year,
          title: year,
          url: fileUrl(yearFolder),
          plans,
        };
      } catch {
        return null;
      }
    }),
  );

  const yearEntries = nested.filter(
    (entry): entry is { year: string; title: string; url: string; plans: DrivePlanFile[] } =>
      Boolean(entry),
  );
  if (!yearEntries.length) return null;

  return {
    years: yearEntries
      .map(({ year, title, url }) => ({ year, title, url }))
      .sort((left, right) => right.year.localeCompare(left.year)),
    plans: mergePlanLists(...yearEntries.map((entry) => entry.plans)),
  };
}

async function filesForMatch(
  indexed: DriveFile[],
  match: (name: string) => boolean,
  fallback?: {
    folder: (name: string) => boolean;
    file: (file: DriveFile) => boolean;
  },
): Promise<{ url?: string; files: BrandFile[] }> {
  const folder = indexed.find((file) => file.mimeType === FOLDER_MIME && match(file.name));
  if (folder) {
    try {
      const kids = await listResolved(folder.id);
      const files = kids
        .filter((file) => file.mimeType !== FOLDER_MIME)
        .map(toBrandFile);
      return { url: fileUrl(folder), files };
    } catch {
      return { url: fileUrl(folder), files: [] };
    }
  }

  const loose = indexed
    .filter((file) => file.mimeType !== FOLDER_MIME && match(file.name))
    .map(toBrandFile);
  if (loose.length) {
    return { url: loose[0].viewUrl, files: loose };
  }

  if (fallback) {
    const parent = indexed.find(
      (file) => file.mimeType === FOLDER_MIME && fallback.folder(file.name),
    );
    if (parent) {
      try {
        const kids = await listResolved(parent.id);
        const files = kids
          .filter((file) => file.mimeType !== FOLDER_MIME && fallback.file(file))
          .map(toBrandFile);
        if (files.length) return { url: fileUrl(parent), files };
      } catch {
        return { url: fileUrl(parent), files: [] };
      }
    }
  }

  const url = pickNamedAsset(indexed, match);
  return { url, files: [] };
}

function plansFromStoredUrls(drive: TenantDriveConfig): DrivePlanFile[] {
  if (!drive.planUrls) return [];
  return Object.entries(drive.planUrls)
    .map(([month, url]) => ({
      month,
      title: month,
      url,
    }))
    .sort((left, right) => right.month.localeCompare(left.month));
}

export async function loadDrivePlansCatalog(
  drive: TenantDriveConfig | undefined,
): Promise<DrivePlansCatalog> {
  const empty: DrivePlansCatalog = {
    plansFolderUrl: drive?.plansFolderUrl,
    plansFolderTitle: undefined,
    planYears: [],
    plans: drive ? plansFromStoredUrls(drive) : [],
    logoUrl: drive?.logoUrl,
    briefUrl: drive?.briefUrl,
    competitorUrl: drive?.competitorUrl,
    logoFiles: [],
    briefFiles: [],
    competitorFiles: [],
    reports: [],
  };
  if (!drive) return empty;

  if (!isDriveConfigured()) {
    return empty;
  }

  try {
    const indexed = drive.rootFolderId ? await walkDriveIndex(drive.rootFolderId) : [];
    const folder = await findPlansFolder(drive, indexed);
    const stored = plansFromStoredUrls(drive);
    const [logo, brief, competitor] = await Promise.all([
      filesForMatch(indexed, looksLikeLogo, {
        folder: looksLikeIdentity,
        file: isLogoishFile,
      }),
      filesForMatch(indexed, looksLikeBrief),
      filesForMatch(indexed, looksLikeCompetitor),
    ]);

    const discovered = {
      logoUrl: drive.logoUrl || logo.url,
      briefUrl: drive.briefUrl || brief.url,
      competitorUrl: drive.competitorUrl || competitor.url,
      logoFiles: logo.files,
      briefFiles: brief.files,
      competitorFiles: competitor.files,
    };

    if (!folder) {
      const bare = await collectBareYearPlans(indexed, "plan");
      const fromIndex = bare
        ? bare.plans
        : await plansFromChildren(
            indexed.filter((file) => {
              if (looksLikeNoiseName(file.name) || looksLikeReport(file.name)) return false;
              const folded = foldLabel(file.name);
              return folded.includes("plan") || looksLikeContentPlanFolder(file.name);
            }),
            undefined,
            "plan",
          );
      const planish = indexed.find(
        (file) => looksLikeContentPlanFolder(file.name) && file.mimeType !== FOLDER_MIME,
      );
      const merged = mergePlanLists(stored, fromIndex);
      const reportsFolder = await findNamedFolder(indexed, looksLikeReportsFolder);
      const reports = reportsFolder
        ? (await plansFromFolder(reportsFolder, "report")).plans
        : [];
      return {
        plansFolderUrl:
          drive.plansFolderUrl ||
          bare?.years[0]?.url ||
          (planish ? fileUrl(planish) : undefined),
        plansFolderTitle: bare ? undefined : planish?.name,
        planYears: bare?.years ?? yearsFromPlans(merged),
        plans: merged,
        reports,
        ...discovered,
      };
    }

    const listed = await plansFromFolder(folder, "plan");
    const merged = mergePlanLists(stored, listed.plans);
    const reportsFolder = await findNamedFolder(indexed, looksLikeReportsFolder);
    const reports =
      reportsFolder && reportsFolder.id !== folder.id
        ? (await plansFromFolder(reportsFolder, "report")).plans
        : [];
    return {
      plansFolderUrl: listed.folder.url ?? drive.plansFolderUrl,
      plansFolderTitle: listed.folder.name,
      planYears: listed.years.length ? listed.years : yearsFromPlans(merged),
      plans: merged,
      reports,
      ...discovered,
    };
  } catch (error) {
    if (error instanceof DriveApiError) {
      console.error(`[drive] plans listing failed: ${error.message}`);
    } else {
      console.error("[drive] plans listing failed");
    }
    return empty;
  }
}
