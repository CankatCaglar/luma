import {
  ASANA_API_BASE,
  PROJECT_OPT_FIELDS,
  TASK_OPT_FIELDS,
  TASK_RESOURCE_FIELDS,
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
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const body: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractAsanaError(body) ?? `Asana request failed (${response.status})`;
    throw new AsanaApiError(message, response.status, body);
  }

  return body as T;
}

async function asanaPost<T>(path: string, body: unknown): Promise<T> {
  const token = requireAsanaToken();
  const response = await fetch(buildUrl(path), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });

  const payload: unknown = await response.json().catch(() => null);

  if (!response.ok) {
    const message = extractAsanaError(payload) ?? `Asana request failed (${response.status})`;
    throw new AsanaApiError(message, response.status, payload);
  }

  return payload as T;
}

function extractAsanaError(body: unknown): string | null {
  if (!body || typeof body !== "object" || !("errors" in body)) return null;
  const errors = (body as { errors?: Array<{ message?: string }> }).errors;
  return errors?.[0]?.message ?? null;
}

function isExpiredOffsetError(error: unknown): boolean {
  return (
    error instanceof AsanaApiError &&
    /pagination token has expired/i.test(error.message)
  );
}

async function asanaListAll<T>(path: string, query: Query = {}): Promise<T[]> {
  const items: T[] = [];
  let offset: string | undefined;
  let pages = 0;
  let retriedExpiredOffset = false;

  while (pages < MAX_PAGES) {
    try {
      const page = await asanaFetch<AsanaListResponse<T>>(path, {
        ...query,
        limit: String(PAGE_LIMIT),
        offset,
      });
      items.push(...page.data);
      pages += 1;
      offset = page.next_page?.offset;
      if (!offset) break;
    } catch (error) {
      if (offset && !retriedExpiredOffset && isExpiredOffsetError(error)) {
        retriedExpiredOffset = true;
        items.length = 0;
        offset = undefined;
        pages = 0;
        continue;
      }
      throw error;
    }
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

function completedSinceIso(): string {
  const date = new Date();
  date.setMonth(date.getMonth() - 12);
  return date.toISOString();
}

export async function getProjectTasks(projectGid: string): Promise<AsanaTask[]> {
  return asanaListAll<AsanaTask>(`/projects/${projectGid}/tasks`, {
    completed_since: completedSinceIso(),
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

export async function getTaskResources(
  taskGids: string[],
): Promise<Map<string, Pick<AsanaTask, "html_notes" | "attachments">>> {
  const details = new Map<string, Pick<AsanaTask, "html_notes" | "attachments">>();
  if (taskGids.length === 0) return details;

  const unique = [...new Set(taskGids)];
  const concurrency = Math.min(6, unique.length);
  let next = 0;

  async function worker() {
    while (next < unique.length) {
      const gid = unique[next];
      next += 1;
      const { data } = await asanaFetch<AsanaItemResponse<AsanaTask>>(
        `/tasks/${gid}`,
        { opt_fields: TASK_RESOURCE_FIELDS },
      );
      details.set(gid, {
        html_notes: data.html_notes,
        attachments: data.attachments,
      });
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return details;
}

export async function createTask(input: {
  name: string;
  notes?: string;
  projects: string[];
  memberships?: Array<{ project: string; section: string }>;
}): Promise<{ gid: string; permalink_url?: string }> {
  const data: {
    name: string;
    notes?: string;
    projects?: string[];
    memberships?: Array<{ project: string; section: string }>;
  } = {
    name: input.name,
    notes: input.notes,
  };
  if (input.memberships?.length) {
    data.memberships = input.memberships;
  } else if (input.projects.length) {
    data.projects = input.projects;
  }

  const payload = await asanaPost<
    AsanaItemResponse<{ gid: string; permalink_url?: string }>
  >("/tasks", {
    data,
  });

  return payload.data;
}
