import {
  getBrandTasks,
  getProjects,
  getSections,
  getWorkspaces,
} from "@/lib/asana/client";
import { getAsanaEnv } from "@/lib/asana/config";
import { foldLabel } from "@/lib/asana/map";
import type { AsanaWorkspace } from "@/lib/asana/types";

export type AsanaWorkspaceOption = {
  gid: string;
  name: string;
};

export type BrandLookupProject = {
  gid: string;
  name: string;
  taskCount: number;
};

export type BrandLookupRequest = {
  projectGid: string;
  projectName: string;
  sectionGid?: string;
  sectionName?: string;
};

export type BrandLookupResult = {
  workspaces: AsanaWorkspaceOption[];
  workspaceGid: string;
  workspaceName: string | null;
  brandCode: string;
  found: boolean;
  taskCount: number;
  projects: BrandLookupProject[];
  projectGids: string[];
  request?: BrandLookupRequest;
  usedWorkspaceDefaults: boolean;
};

const REQUEST_PROJECT_ALIASES = [
  "management brief",
  "management",
];

const REQUEST_SECTION_ALIASES = [
  "management brief",
  "brief kontrol",
  "brief",
];

const MAX_WORKSPACE_SCAN = 15;
const SCAN_CACHE_MS = 60_000;

type WorkspaceScan = {
  expiresAt: number;
  workspaces: AsanaWorkspace[];
  projects: Array<{ gid: string; name: string }>;
  configuredGids: string[];
  scanGids: string[];
  request?: BrandLookupRequest;
};

const workspaceScans = new Map<string, WorkspaceScan>();

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function findByAliases<T extends { name: string }>(
  items: T[],
  aliases: string[],
): T | undefined {
  for (const alias of aliases) {
    const foldedAlias = foldLabel(alias);
    if (!foldedAlias) continue;
    const exact = items.find((item) => foldLabel(item.name) === foldedAlias);
    if (exact) return exact;
    const partial = items.find((item) => foldLabel(item.name).includes(foldedAlias));
    if (partial) return partial;
  }
  return undefined;
}

export async function listAsanaWorkspaces(): Promise<{
  workspaces: AsanaWorkspaceOption[];
  workspaceGid: string;
  workspaceName: string | null;
}> {
  const env = getAsanaEnv();
  const workspaces = await getWorkspaces();
  const workspaceGid = env.workspaceGid || workspaces[0]?.gid || "";
  return {
    workspaces: workspaces.map((workspace) => ({
      gid: workspace.gid,
      name: workspace.name,
    })),
    workspaceGid,
    workspaceName:
      workspaces.find((workspace) => workspace.gid === workspaceGid)?.name ??
      workspaces[0]?.name ??
      null,
  };
}

async function resolveRequestTarget(input: {
  workspaceProjects: Array<{ gid: string; name: string }>;
  configuredRequestProjectGid?: string;
  configuredRequestSectionGid?: string;
}): Promise<BrandLookupRequest | undefined> {
  const configuredProject = input.configuredRequestProjectGid
    ? input.workspaceProjects.find(
        (project) => project.gid === input.configuredRequestProjectGid,
      )
    : undefined;
  const project = configuredProject ?? findByAliases(input.workspaceProjects, REQUEST_PROJECT_ALIASES);
  if (!project) return undefined;

  let sectionGid = input.configuredRequestSectionGid;
  let sectionName: string | undefined;

  try {
    const sections = await getSections(project.gid);
    if (sectionGid) {
      sectionName = sections.find((section) => section.gid === sectionGid)?.name;
      if (!sectionName) sectionGid = undefined;
    }
    if (!sectionGid) {
      const named = findByAliases(sections, REQUEST_SECTION_ALIASES);
      if (named) {
        sectionGid = named.gid;
        sectionName = named.name;
      }
    }
  } catch {
    sectionGid = sectionGid || undefined;
  }

  return {
    projectGid: project.gid,
    projectName: project.name,
    sectionGid,
    sectionName,
  };
}

async function loadWorkspaceScan(workspaceGid: string): Promise<WorkspaceScan> {
  const cacheKey = `mgmt-brief:${workspaceGid}`;
  const cached = workspaceScans.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached;
  }

  const env = getAsanaEnv();
  const [workspaces, projects] = await Promise.all([
    getWorkspaces(),
    getProjects(workspaceGid),
  ]);
  const configuredGids = (env.projectGids ?? []).filter((gid) =>
    projects.some((project) => project.gid === gid),
  );
  const scanGids = (
    configuredGids.length > 0 ? configuredGids : projects.map((project) => project.gid)
  ).slice(0, MAX_WORKSPACE_SCAN);
  const request = await resolveRequestTarget({
    workspaceProjects: projects,
    configuredRequestProjectGid: readEnv("ASANA_REQUEST_PROJECT_GID"),
    configuredRequestSectionGid: readEnv("ASANA_REQUEST_SECTION_GID"),
  });

  const scan: WorkspaceScan = {
    expiresAt: Date.now() + SCAN_CACHE_MS,
    workspaces,
    projects,
    configuredGids,
    scanGids,
    request,
  };
  workspaceScans.set(cacheKey, scan);
  return scan;
}

export async function resolveRequestDestination(
  workspaceGid: string,
): Promise<BrandLookupRequest | undefined> {
  const gid = workspaceGid.trim();
  if (!gid) return undefined;
  const scan = await loadWorkspaceScan(gid);
  return scan.request;
}

export async function lookupBrandInWorkspace(input: {
  workspaceGid: string;
  brandCode: string;
}): Promise<BrandLookupResult> {
  const brandCode = input.brandCode.trim().toUpperCase();
  const workspaceGid = input.workspaceGid.trim();
  const { workspaces, projects, configuredGids, scanGids, request } =
    await loadWorkspaceScan(workspaceGid);

  const workspaceName =
    workspaces.find((workspace) => workspace.gid === workspaceGid)?.name ?? null;
  const projectByGid = new Map(projects.map((project) => [project.gid, project.name]));
  const matched = await getBrandTasks({
    projectGids: scanGids,
    brandCode,
    workspaceGid,
  });

  const matchedCountByProject = new Map<string, number>();
  for (const task of matched) {
    const membershipGids = [
      ...new Set(
        (task.memberships ?? [])
          .map((membership) => membership.project?.gid)
          .filter((gid): gid is string => typeof gid === "string" && projectByGid.has(gid)),
      ),
    ];
    for (const gid of membershipGids) {
      matchedCountByProject.set(gid, (matchedCountByProject.get(gid) ?? 0) + 1);
    }
  }

  const projectGids = [...new Set([...configuredGids, ...matchedCountByProject.keys()])];
  const previewSource = matchedCountByProject.size > 0 ? [...matchedCountByProject.keys()] : projectGids;
  const projectsPreview = previewSource
    .map((gid) => ({
      gid,
      name: projectByGid.get(gid) ?? "Proje",
      taskCount: matchedCountByProject.get(gid) ?? 0,
    }))
    .sort(
      (left, right) =>
        right.taskCount - left.taskCount || left.name.localeCompare(right.name, "tr"),
    );

  return {
    workspaces: workspaces.map((workspace) => ({
      gid: workspace.gid,
      name: workspace.name,
    })),
    workspaceGid,
    workspaceName,
    brandCode,
    found: matched.length > 0,
    taskCount: matched.length,
    projects: projectsPreview,
    projectGids,
    request,
    usedWorkspaceDefaults: configuredGids.length > 0,
  };
}
