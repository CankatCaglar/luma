import { NextResponse } from "next/server";
import { getJobLists } from "@/lib/data/jobs";
import {
  TenantAccessError,
  requireTenantAccess,
} from "@/lib/tenant/requireTenant";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";
    const { user, tenant } = await requireTenantAccess(request);

    const data = await getJobLists({
      fresh,
      scope: {
        tenantId: tenant.tenantId,
        brandName: tenant.brandName,
        brandCode: tenant.asana.brandCode,
        email: user.email,
        projectGids: tenant.asana.projectGids,
      },
    });

    return NextResponse.json(data);
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to load jobs";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
