import { NextResponse } from "next/server";
import {
  listNotifications,
  markAllNotificationsRead,
  unreadNotificationCount,
} from "@/lib/delivery/store";
import {
  TenantAccessError,
  requireTenantAccess,
} from "@/lib/tenant/requireTenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { tenant } = await requireTenantAccess(request);
    const items = await listNotifications(tenant.tenantId);
    const unread = items.filter((item) => !item.read).length;
    return NextResponse.json({
      items: items.map((item) => ({
        id: item.id,
        title: item.title,
        body: item.body,
        href: item.href,
        read: item.read,
        createdAt: item.createdAt,
        category: item.category,
      })),
      unread,
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Bildirimler alınamadı";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { tenant } = await requireTenantAccess(request);
    const updated = await markAllNotificationsRead(tenant.tenantId);
    const unread = await unreadNotificationCount(tenant.tenantId);
    return NextResponse.json({ updated, unread });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Bildirimler güncellenemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
