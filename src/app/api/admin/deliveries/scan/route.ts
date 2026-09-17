import { NextResponse } from "next/server";
import { scanAllTenantDeliveries } from "@/lib/delivery/scan";
import { requireAdminAccess } from "@/lib/tenant/requireAdmin";
import { TenantAccessError } from "@/lib/tenant/requireTenant";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireAdminAccess(request);
    const summary = await scanAllTenantDeliveries();
    return NextResponse.json({ ok: true, ...summary });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Tarama başarısız";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
