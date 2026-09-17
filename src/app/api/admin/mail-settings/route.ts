import { NextResponse } from "next/server";
import { parseMailSettingsBody, readMailSettings, writeMailSettings } from "@/lib/delivery/settings";
import { requireAdminAccess } from "@/lib/tenant/requireAdmin";
import { TenantAccessError } from "@/lib/tenant/requireTenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminAccess(request);
    const settings = await readMailSettings();
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Mail ayarları alınamadı";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    await requireAdminAccess(request);
    const body = await request.json().catch(() => null);
    const parsed = parseMailSettingsBody(body);
    const settings = await writeMailSettings(parsed);
    return NextResponse.json({ settings });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Mail ayarları kaydedilemedi";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
