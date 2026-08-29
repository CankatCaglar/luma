import { NextResponse } from "next/server";
import { AsanaApiError } from "@/lib/asana/client";
import { listAsanaWorkspaces, lookupBrandInWorkspace } from "@/lib/asana/lookup";
import { requireAdminAccess } from "@/lib/tenant/requireAdmin";
import { TenantAccessError } from "@/lib/tenant/requireTenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    await requireAdminAccess(request);
    const url = new URL(request.url);
    const requestedWorkspace = url.searchParams.get("workspaceGid")?.trim();
    const brandCode = url.searchParams.get("brandCode")?.trim().toUpperCase() ?? "";

    if (!brandCode || brandCode.length < 3) {
      const catalog = await listAsanaWorkspaces();
      return NextResponse.json({
        ok: true,
        ...catalog,
        workspaceGid: requestedWorkspace || catalog.workspaceGid,
      });
    }

    const workspaceGid =
      requestedWorkspace || (await listAsanaWorkspaces()).workspaceGid;
    if (!workspaceGid) {
      return NextResponse.json({ error: "Workspace bulunamadı" }, { status: 400 });
    }

    const lookup = await lookupBrandInWorkspace({
      workspaceGid,
      brandCode,
    });

    return NextResponse.json({
      ok: true,
      ...lookup,
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof AsanaApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Asana eşleşmesi alınamadı";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
