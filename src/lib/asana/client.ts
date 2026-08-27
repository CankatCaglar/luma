import {
  ASANA_API_BASE,
  PROJECT_OPT_FIELDS,
  TASK_OPT_FIELDS,
  requireAsanaToken,
} from "@/lib/asana/config";
import type {
  AsanaItemResponse,
  AsanaListResponse,
  AsanaProject,
  AsanaSection,
  AsanaTask,
  AsanaUser,
  AsanaWorkspace,
} from "@/lib/asana/types";

const PAGE_LIMIT = 100;
const MAX_PAGES = 20;

export class AsanaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = "AsanaApiError";
  }
}

type Query = Record<string, string | undefined>;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(
    path.startsWith("http") ? path : `${ASANA_API_BASE}${path}`,
  );
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value) url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

async function asanaFetch<T>(path: string, query?: Query): Promise<T> {
  const token = requireAsanaToken();
  const response = await fetch(buildUrl(path, query), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
    next: { revalidate: 60 },
    signal: AbortSignal.timeout(15_000),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractAsanaError(body) ?? `Asana request failed (${response.status})`;
    throw new AsanaApiError(message, response.status, body);
  }

  return body as T;
}

function extractAsanaError(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("errors" in body)) return null;
  const errors = (body as { errors?: Array<{ message?: string }> }).errors;
  return errors?.[0]?.message ?? null;
}

async function asanaListAll<T>(path: string, query: Query = {}): Promise<T[]> {
  const items: T[] = [];
  let offset: string | undefined;
  let pages = 0;

  while (pages < MAX_PAGES) {
    const page = await asanaFetch<AsanaListResponse<T>>(path, {
      ...query,
      limit: String(PAGE_LIMIT),
      offset,
    });
    items.push(...page.data);
    pages += 1;
    offset = page.next_page?.offset;
    if (!offset) break;
  }

  return items;
}

export async function getMe(): Promise<AsanaUser> {
  const { data } = await asanaFetch<AsanaItemResponse<AsanaUser>>("/users/me", {
    opt_fields: "gid,name,email",
  });
  return data;
}

export async function getWorkspaces(): Promise<AsanaWorkspace[]> {
  return asanaListAll<AsanaWorkspace>("/workspaces", {
    opt_fields: "gid,name",
  });
}

export async function getProjects(
  workspaceGid: string,
): Promise<Pick<AsanaProject, "gid" | "name">[]> {
  return asanaListAll<Pick<AsanaProject, "gid" | "name">>("/projects", {
    workspace: workspaceGid,
    archived: "false",
    opt_fields: "gid,name",
  });
}

export async function getProject(projectGid: string): Promise<AsanaProject> {
  const { data } = await asanaFetch<AsanaItemResponse<AsanaProject>>(
    `/projects/${projectGid}`,
    { opt_fields: PROJECT_OPT_FIELDS },
  );
  return data;
}

export async function getSections(projectGid: string): Promise<AsanaSection[]> {
  return asanaListAll<AsanaSection>(`/projects/${projectGid}/sections`, {
    opt_fields: "gid,name",
  });
}

export async function getProjectTasks(projectGid: string): Promise<AsanaTask[]> {
  return asanaListAll<AsanaTask>(`/projects/${projectGid}/tasks`, {
    completed_since: "2000-01-01",
    opt_fields: TASK_OPT_FIELDS,
  });
}

export async function getTasksForProjects(
  projectGids: string[],
): Promise<AsanaTask[]> {
  const groups = await Promise.all(
    projectGids.map((projectGid) => getProjectTasks(projectGid)),
  );
  const byGid = new Map<string, AsanaTask>();
  for (const tasks of groups) {
    for (const task of tasks) {
      const existing = byGid.get(task.gid);
      if (!existing) {
        byGid.set(task.gid, task);
        continue;
      }
      byGid.set(task.gid, {
        ...existing,
        ...task,
        memberships: [
          ...(existing.memberships ?? []),
          ...(task.memberships ?? []),
        ],
      });
    }
  }
  return [...byGid.values()];
}
