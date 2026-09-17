import { NextResponse } from "next/server";
import { getTask } from "@/lib/asana/client";
import {
  displayTaskTitle,
  extractResourceUrl,
  mapTaskKind,
  parseMonthKey,
} from "@/lib/asana/map";
import { EVENT_LABELS } from "@/lib/delivery/copy";
import { sendDelivery } from "@/lib/delivery/send";
import { listDeliveries } from "@/lib/delivery/store";
import {
  isDeliveryEventType,
  type DeliveryEventType,
} from "@/lib/delivery/types";
import { getTenantById } from "@/lib/tenant/access";
import { requireAdminAccess } from "@/lib/tenant/requireAdmin";
import { TenantAccessError } from "@/lib/tenant/requireTenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminAccess(request);
    const url = new URL(request.url);
    const tenantId = url.searchParams.get("tenantId")?.trim() || undefined;
    const deliveries = await listDeliveries({
      tenantId,
      limit: Number(url.searchParams.get("limit") ?? 80) || 80,
    });
    return NextResponse.json({
      deliveries,
      eventLabels: EVENT_LABELS,
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "İletim geçmişi alınamadı";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

type CreateBody = {
  tenantId?: string;
  eventType?: string;
  taskGid?: string;
  taskTitle?: string;
  customerLink?: string;
  inApp?: boolean;
  email?: boolean;
};

export async function POST(request: Request) {
  try {
    await requireAdminAccess(request);
    const body = (await request.json().catch(() => null)) as CreateBody | null;
    const tenantId = body?.tenantId?.trim() ?? "";
    if (!tenantId) {
      throw new TenantAccessError("Marka seçilmedi", 400);
    }
    const eventType = body?.eventType?.trim() ?? "";
    if (!isDeliveryEventType(eventType)) {
      throw new TenantAccessError("Geçerli bir olay tipi seçin", 400);
    }

    const tenant = await getTenantById(tenantId);
    if (!tenant) {
      throw new TenantAccessError("Marka bulunamadı", 404);
    }

    const inApp = body?.inApp !== false;
    const email = body?.email !== false;
    if (!inApp && !email) {
      throw new TenantAccessError("En az bir kanal seçin", 400);
    }

    let taskTitle = body?.taskTitle?.trim() ?? "";
    let customerLink = body?.customerLink?.trim() || undefined;
    let monthKey: string | undefined;
    const taskGid = body?.taskGid?.trim() || undefined;

    if (taskGid) {
      const task = await getTask(taskGid);
      taskTitle = taskTitle || displayTaskTitle(task.name, tenant.asana.brandCode) || task.name;
      const kind = mapTaskKind(task, { brandCode: tenant.asana.brandCode });
      customerLink =
        customerLink || extractResourceUrl(task.html_notes, task.attachments, kind);
      monthKey = parseMonthKey(taskTitle, new Date().toISOString().slice(0, 10));
    }

    if (!taskTitle) {
      throw new TenantAccessError("Görev başlığı gerekli", 400);
    }

    const delivery = await sendDelivery({
      tenant,
      eventType: eventType as DeliveryEventType,
      taskTitle,
      taskGid,
      customerLink,
      monthKey,
      source: "manual",
      channels: { inApp, email },
    });

    return NextResponse.json({ delivery });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Gönderim başarısız";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
