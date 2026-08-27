import { NextResponse } from "next/server";
import {
  AsanaApiError,
  getMe,
  getProject,
  getProjects,
  getSections,
  getTasksForProjects,
  getWorkspaces,
} from "@/lib/asana/client";
import { getAsanaEnv } from "@/lib/asana/config";
import {
  foldLabel,
  isBrandTask,
  mapTaskKind,
  mapTaskStatus,
  taskSectionName,
} from "@/lib/asana/map";
import type { AsanaTask } from "@/lib/asana/types";

function summarizeTask(task: AsanaTask, projectGid?: string) {
  return {
    gid: task.gid,
    name: task.name,
    completed: task.completed,
    due_on: task.due_on ?? null,
    section: projectGid ? taskSectionName(task, projectGid) ?? null : null,
    mappedStatus: mapTaskStatus(task, projectGid),
    mappedKind: mapTaskKind(task),
    custom_fields: (task.custom_fields ?? []).map((field) => ({
      name: field.name,
      display_value: field.display_value ?? null,
      enum_value: field.enum_value?.name ?? null,
    })),
    tags: (task.tags ?? []).map((tag) => tag.name),
    attachments: (task.attachments ?? []).map((attachment) => attachment.name),
    notesPreview: task.html_notes
      ? task.html_notes.replace(/<[^>]+>/g, " ").slice(0, 200).trim()
      : null,
  };
}

export async function GET() {
  if (process.env.NODE_ENV !== "development") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const env = getAsanaEnv();
  if (!env.accessToken) {
    return NextResponse.json(
      {
        ok: false,
        error: "ASANA_ACCESS_TOKEN is not set",
        hint: "Put ASANA_ACCESS_TOKEN in .env.local (https://app.asana.com/0/my-apps)",
      },
      { status: 503 },
    );
  }

  try {
    const me = await getMe();
    const workspaces = await getWorkspaces();
    const workspaceGid = env.workspaceGid ?? workspaces[0]?.gid;
    const projects = workspaceGid ? await getProjects(workspaceGid) : [];
    const projectGids = env.projectGids ?? [];
    const brandCode = env.brandCode;

    const selectedProjects = await Promise.all(
      projectGids.map(async (gid) => {
        const project = await getProject(gid);
        const sections = await getSections(gid);
        return {
          gid: project.gid,
          name: project.name,
          permalink_url: project.permalink_url ?? null,
          customFields: (project.custom_field_settings ?? []).map((setting) => ({
            gid: setting.custom_field.gid,
            name: setting.custom_field.name,
            folded: foldLabel(setting.custom_field.name),
            resource_subtype: setting.custom_field.resource_subtype ?? null,
            enum_options: (setting.custom_field.enum_options ?? []).map(
              (option) => option.name,
            ),
          })),
          sections: sections.map((section) => ({
            gid: section.gid,
            name: section.name,
            folded: foldLabel(section.name),
          })),
        };
      }),
    );

    const tasks =
      projectGids.length > 0 ? await getTasksForProjects(projectGids) : [];
    const matched = brandCode
      ? tasks.filter((task) => isBrandTask(task, brandCode))
      : [];

    return NextResponse.json({
      ok: true,
      me: { gid: me.gid, name: me.name, email: me.email ?? null },
      configured: {
        hasToken: true,
        workspaceGid: env.workspaceGid ?? null,
        projectGids,
        brandCode: brandCode ?? null,
        statusField: env.statusFieldName ?? null,
        kindField: env.kindFieldName ?? null,
      },
      workspaces,
      projects,
      selectedProjects,
      taskCount: tasks.length,
      matchedCount: matched.length,
      sampleTasks: matched.slice(0, 15).map((task) =>
        summarizeTask(task, projectGids[0]),
      ),
    });
  } catch (error) {
    const message =
      error instanceof AsanaApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Asana inspect failed";
    const status = error instanceof AsanaApiError ? error.status : 502;
    return NextResponse.json({ ok: false, error: message }, { status });
  }
}
