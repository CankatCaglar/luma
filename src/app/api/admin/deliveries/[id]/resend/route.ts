import { NextResponse } from "next/server";
import { resendDelivery } from "@/lib/delivery/send";
import { requireAdminAccess } from "@/lib/tenant/requireAdmin";
import { TenantAccessError } from "@/lib/tenant/requireTenant";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminAccess(request);
    const { id } = await context.params;
    if (!id?.trim()) {
      throw new TenantAccessError("Kayıt seçilmedi", 400);
    }
    const delivery = await resendDelivery(id.trim());
    return NextResponse.json({ delivery });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Yeniden gönderilemedi";
    const status = message.includes("bulunamadı") ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
