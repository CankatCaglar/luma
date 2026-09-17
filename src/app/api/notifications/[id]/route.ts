import { NextResponse } from "next/server";
import { deleteNotification, markNotificationRead } from "@/lib/delivery/store";
import {
  TenantAccessError,
  requireTenantAccess,
} from "@/lib/tenant/requireTenant";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { tenant } = await requireTenantAccess(request);
    const { id } = await context.params;
    const updated = await markNotificationRead(id, tenant.tenantId);
    if (!updated) {
      return NextResponse.json({ error: "Bildirim bulunamadı" }, { status: 404 });
    }
    return NextResponse.json({
      item: {
        id: updated.id,
        title: updated.title,
        body: updated.body,
        href: updated.href,
        read: updated.read,
        createdAt: updated.createdAt,
        category: updated.category,
      },
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Bildirim güncellenemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { tenant } = await requireTenantAccess(request);
    const { id } = await context.params;
    const deleted = await deleteNotification(id, tenant.tenantId);
    if (!deleted) {
      return NextResponse.json({ error: "Bildirim bulunamadı" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Bildirim silinemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
