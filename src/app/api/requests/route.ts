import { NextResponse } from "next/server";
import { AsanaApiError, createTask } from "@/lib/asana/client";
import { getAsanaEnv } from "@/lib/asana/config";
import { resolveRequestDestination } from "@/lib/asana/lookup";
import {
  TenantAccessError,
  requireTenantAccess,
} from "@/lib/tenant/requireTenant";
import type { RequestPriority, RequestType } from "@/types";

type CreateRequestBody = {
  type: RequestType;
  subject: string;
  brief: string;
  priority: RequestPriority;
  fileName?: string | null;
};

function isRequestType(value: string): value is RequestType {
  return ["video", "design", "content", "ads", "other"].includes(value);
}

function isRequestPriority(value: string): value is RequestPriority {
  return value === "standard" || value === "urgent";
}

function parseBody(input: unknown): CreateRequestBody {
  if (!input || typeof input !== "object") {
    throw new TenantAccessError("Invalid request body", 400);
  }
  const body = input as Partial<CreateRequestBody>;
  if (!body.type || !isRequestType(body.type)) {
    throw new TenantAccessError("Invalid request type", 400);
  }
  if (!body.priority || !isRequestPriority(body.priority)) {
    throw new TenantAccessError("Invalid request priority", 400);
  }

  const subject = body.subject?.trim() ?? "";
  const brief = body.brief?.trim() ?? "";
  if (subject.length < 3 || subject.length > 140) {
    throw new TenantAccessError("Subject must be between 3 and 140 chars", 400);
  }
  if (brief.length < 10 || brief.length > 3000) {
    throw new TenantAccessError("Brief must be between 10 and 3000 chars", 400);
  }

  return {
    type: body.type,
    priority: body.priority,
    subject,
    brief,
    fileName: body.fileName?.trim() || undefined,
  };
}

function buildRequestNotes(input: {
  brief: string;
  priority: RequestPriority;
  type: RequestType;
  requesterEmail: string;
  brandCode: string;
  fileName?: string;
}): string {
  const lines = [
    `Marka kodu: ${input.brandCode}`,
    `Talep türü: ${input.type}`,
    `Öncelik: ${input.priority}`,
    `Talep sahibi: ${input.requesterEmail}`,
  ];
  if (input.fileName) {
    lines.push(`Referans dosyası: ${input.fileName}`);
  }
  lines.push("", input.brief);
  return lines.join("\n");
}

function buildRequestTaskName(brandCode: string, subject: string): string {
  const code = brandCode.trim().toUpperCase();
  const title = subject
    .trim()
    .replace(new RegExp(`^[\\[\\(]?${code}[\\]\\)]?\\s*[-–—:]?\\s*`, "i"), "")
    .trim();
  return title ? `${code} - ${title}` : code;
}

export async function POST(request: Request) {
  try {
    const { user, tenant } = await requireTenantAccess(request);
    const body = parseBody(await request.json());
    const workspaceGid =
      tenant.asana.workspaceGid?.trim() || getAsanaEnv().workspaceGid || "";
    const destination = workspaceGid
      ? await resolveRequestDestination(workspaceGid)
      : undefined;
    const project = destination?.projectGid;
    const section = destination?.sectionGid;
    if (!project || !section) {
      throw new TenantAccessError(
        "Asana Management Brief bölümü bulunamadı",
        500,
      );
    }

    const created = await createTask({
      name: buildRequestTaskName(tenant.asana.brandCode, body.subject),
      notes: buildRequestNotes({
        brandCode: tenant.asana.brandCode,
        brief: body.brief,
        priority: body.priority,
        type: body.type,
        requesterEmail: user.email,
        fileName: body.fileName ?? undefined,
      }),
      projects: [project],
      memberships: [{ project, section }],
      assignee: null,
    });

    return NextResponse.json({
      ok: true,
      taskGid: created.gid,
      permalinkUrl: created.permalink_url ?? null,
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof AsanaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
