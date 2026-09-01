import { NextResponse } from "next/server";
import { getDriveRuntimeStatus } from "@/lib/drive/client";
import { requireAdminAccess } from "@/lib/tenant/requireAdmin";
import { TenantAccessError } from "@/lib/tenant/requireTenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminAccess(request);
    const status = await getDriveRuntimeStatus();
    return NextResponse.json({
      ok: true,
      ...status,
      shareHint:
        "Bu e-postayı markanın Drive kutusuna Viewer olarak ekle. Alt klasörler genelde otomatik görünür.",
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Drive durumu alınamadı";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
