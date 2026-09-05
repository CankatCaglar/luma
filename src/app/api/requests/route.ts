import { NextResponse } from "next/server";
import {
  AsanaApiError,
  createTask,
  insertTaskAtSectionTop,
} from "@/lib/asana/client";
import { getAsanaEnv } from "@/lib/asana/config";
import { resolveRequestDestination } from "@/lib/asana/lookup";
import { resolveAsanaPriority } from "@/lib/asana/priority";
import {
  PRIORITY_LABELS,
  formatRequestType,
  isAsanaPriorityLevel,
  isRequestCategory,
  isSubtypeOf,
  type AsanaPriorityLevel,
  type RequestCategory,
} from "@/lib/requests/catalog";
import {
  TenantAccessError,
  requireTenantAccess,
} from "@/lib/tenant/requireTenant";
import type { RequestPriority } from "@/types";

type CreateRequestBody = {
  category: RequestCategory;
  subtype?: string;
  subject: string;
  brief: string;
  priority: RequestPriority;
  asanaPriority: AsanaPriorityLevel;
  urgentReason?: string;
  dueDate?: string;
  fileName?: string | null;
};

function isRequestPriority(value: string): value is RequestPriority {
  return value === "standard" || value === "urgent";
}

function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function parseBody(input: unknown): CreateRequestBody {
  if (!input || typeof input !== "object") {
    throw new TenantAccessError("Geçersiz talep içeriği", 400);
  }
  const body = input as Partial<CreateRequestBody> & { type?: string };
  const category = body.category ?? body.type;
  if (!category || !isRequestCategory(category)) {
    throw new TenantAccessError("Talep türü seçilmedi", 400);
  }
  if (!body.priority || !isRequestPriority(body.priority)) {
    throw new TenantAccessError("Öncelik seçilmedi", 400);
  }
  if (!body.asanaPriority || !isAsanaPriorityLevel(body.asanaPriority)) {
    throw new TenantAccessError("Asana önceliği seçilmedi", 400);
  }

  const subtype = body.subtype?.trim() || undefined;
  if (category !== "other" && (!subtype || !isSubtypeOf(category, subtype))) {
    throw new TenantAccessError("Alt tür seçilmedi", 400);
  }

  const subject = body.subject?.trim() ?? "";
  const brief = body.brief?.trim() ?? "";
  if (subject.length < 3 || subject.length > 140) {
    throw new TenantAccessError("Başlık 3-140 karakter olmalı", 400);
  }
  if (brief.length < 3 || brief.length > 1000) {
    throw new TenantAccessError("Brief 3-1000 karakter olmalı", 400);
  }

  const urgentReason = body.urgentReason?.trim() || undefined;
  const dueDate = body.dueDate?.trim() || undefined;
  if (body.priority === "urgent") {
    if (!urgentReason || urgentReason.length < 3) {
      throw new TenantAccessError("Acil talep nedeni gerekli", 400);
    }
    if (!dueDate || !isIsoDate(dueDate)) {
      throw new TenantAccessError("İstenen teslim tarihi gerekli", 400);
    }
  }

  return {
    category,
    subtype: category === "other" ? undefined : subtype,
    priority: body.priority,
    asanaPriority: body.asanaPriority,
    subject,
    brief,
    urgentReason,
    dueDate,
    fileName: body.fileName?.trim() || undefined,
  };
}

function buildRequestNotes(input: {
  brief: string;
  priority: RequestPriority;
  category: RequestCategory;
  subtype?: string;
  asanaPriority: AsanaPriorityLevel;
  requesterEmail: string;
  brandCode: string;
  urgentReason?: string;
  dueDate?: string;
  fileName?: string;
}): string {
  const lines = [
    `Marka kodu: ${input.brandCode}`,
    `Talep türü: ${formatRequestType(input.category, input.subtype)}`,
    `Teslim önceliği: ${input.priority === "urgent" ? "Acil" : "Standart"}`,
    `Asana önceliği: ${PRIORITY_LABELS[input.asanaPriority]}`,
    `Talep sahibi: ${input.requesterEmail}`,
  ];
  if (input.urgentReason) {
    lines.push(`Acil talep nedeni: ${input.urgentReason}`);
  }
  if (input.dueDate) {
    lines.push(`İstenen teslim tarihi: ${input.dueDate}`);
  }
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

    const asanaPriority = workspaceGid
      ? await resolveAsanaPriority({
          workspaceGid,
          projectGid: project,
          level: body.asanaPriority,
        })
      : {};

    const created = await createTask({
      name: buildRequestTaskName(tenant.asana.brandCode, body.subject),
      notes: buildRequestNotes({
        brandCode: tenant.asana.brandCode,
        brief: body.brief,
        priority: body.priority,
        category: body.category,
        subtype: body.subtype,
        asanaPriority: body.asanaPriority,
        requesterEmail: user.email,
        urgentReason: body.urgentReason,
        dueDate: body.dueDate,
        fileName: body.fileName ?? undefined,
      }),
      projects: [project],
      memberships: [{ project, section }],
      assignee: null,
      dueOn: body.dueDate,
      tags: asanaPriority.tagGid ? [asanaPriority.tagGid] : undefined,
      customFields: asanaPriority.customFields,
    });

    try {
      await insertTaskAtSectionTop(section, created.gid);
    } catch {
      /* task exists even if reorder fails */
    }

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
    const message = error instanceof Error ? error.message : "Talep oluşturulamadı";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
