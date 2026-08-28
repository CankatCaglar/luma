import { NextResponse } from "next/server";
import { AsanaApiError, getProjects, getSections, getWorkspaces } from "@/lib/asana/client";
import { getAsanaEnv } from "@/lib/asana/config";
import { requireAdminAccess } from "@/lib/tenant/requireAdmin";
import { TenantAccessError } from "@/lib/tenant/requireTenant";

export const dynamic = "force-dynamic";

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

export async function GET(request: Request) {
  try {
    await requireAdminAccess(request);
    const env = getAsanaEnv();
    const url = new URL(request.url);
    const selectedWorkspace =
      url.searchParams.get("workspaceGid")?.trim() || env.workspaceGid;
    const selectedProject = url.searchParams.get("projectGid")?.trim() || undefined;

    const workspaces = await getWorkspaces();
    const workspaceGid = selectedWorkspace || workspaces[0]?.gid;
    const projects = workspaceGid ? await getProjects(workspaceGid) : [];
    const sections = selectedProject ? await getSections(selectedProject) : [];

    return NextResponse.json({
      ok: true,
      workspaceGid: workspaceGid ?? null,
      workspaces: workspaces.map((workspace) => ({
        gid: workspace.gid,
        name: workspace.name,
      })),
      projects: projects.map((project) => ({
        gid: project.gid,
        name: project.name,
      })),
      sections: sections.map((section) => ({
        gid: section.gid,
        name: section.name,
      })),
      configured: {
        workspaceGid: env.workspaceGid ?? null,
        projectGids: env.projectGids ?? [],
        requestProjectGid: readEnv("ASANA_REQUEST_PROJECT_GID") ?? null,
        requestSectionGid: readEnv("ASANA_REQUEST_SECTION_GID") ?? null,
      },
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof AsanaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to load Asana catalog";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
