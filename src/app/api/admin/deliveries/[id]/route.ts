import { NextResponse } from "next/server";
import { deleteDelivery } from "@/lib/delivery/store";
import { requireAdminAccess } from "@/lib/tenant/requireAdmin";
import { TenantAccessError } from "@/lib/tenant/requireTenant";

export const dynamic = "force-dynamic";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdminAccess(request);
    const { id } = await context.params;
    if (!id?.trim()) {
      throw new TenantAccessError("Kayıt seçilmedi", 400);
    }
    const removed = await deleteDelivery(id.trim());
    if (!removed) {
      throw new TenantAccessError("İletim kaydı bulunamadı", 404);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Kayıt kaldırılamadı";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
