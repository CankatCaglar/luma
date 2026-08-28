import { NextResponse } from "next/server";
import { AsanaApiError, createTask } from "@/lib/asana/client";
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

export async function POST(request: Request) {
  try {
    const { user, tenant } = await requireTenantAccess(request);
    const body = parseBody(await request.json());

    const project = tenant.asana.requestProjectGid ?? tenant.asana.projectGids[0];
    if (!project) {
      throw new TenantAccessError("Tenant request project is not configured", 500);
    }

    const taskName = `[${tenant.asana.brandCode}] ${body.subject}`;
    const created = await createTask({
      name: taskName,
      notes: buildRequestNotes({
        brandCode: tenant.asana.brandCode,
        brief: body.brief,
        priority: body.priority,
        type: body.type,
        requesterEmail: user.email,
        fileName: body.fileName ?? undefined,
      }),
      projects: [project],
      memberships: tenant.asana.requestSectionGid
        ? [{ project, section: tenant.asana.requestSectionGid }]
        : undefined,
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
