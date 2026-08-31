import { NextResponse } from "next/server";
import { getAsanaEnv } from "@/lib/asana/config";
import { lookupBrandInWorkspace } from "@/lib/asana/lookup";
import { getAdminAuth } from "@/lib/firebase/admin";
import {
  getTenantByEmail,
  listTenantDirectory,
  slugTenantId,
  upsertTenant,
  type TenantAccess,
} from "@/lib/tenant/access";
import { requireAdminAccess } from "@/lib/tenant/requireAdmin";
import { TenantAccessError } from "@/lib/tenant/requireTenant";

type CreateTenantBody = {
  brandName: string;
  brandCode: string;
  email: string;
  password: string;
  projectGids: string;
  requestProjectGid?: string;
  requestSectionGid?: string;
  workspaceGid?: string;
};

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(/[,\s]+/).map((part) => part.trim()).filter(Boolean))];
}

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function createTempPassword(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `Luma!${random}9`;
}

function parseBody(input: unknown): CreateTenantBody {
  if (!input || typeof input !== "object") {
    throw new TenantAccessError("Invalid payload", 400);
  }
  const body = input as Partial<CreateTenantBody>;
  const brandName = body.brandName?.trim() ?? "";
  const brandCode = body.brandCode?.trim().toUpperCase() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const projectGids = body.projectGids?.trim() ?? "";
  const password = body.password?.trim() || createTempPassword();

  if (brandName.length < 2) {
    throw new TenantAccessError("Brand name is required", 400);
  }
  if (brandCode.length < 2) {
    throw new TenantAccessError("Brand code is required", 400);
  }
  if (!email.includes("@")) {
    throw new TenantAccessError("Valid email is required", 400);
  }
  if (password.length < 8) {
    throw new TenantAccessError("Password must be at least 8 chars", 400);
  }

  return {
    brandName,
    brandCode,
    email,
    password,
    projectGids,
    requestProjectGid: body.requestProjectGid?.trim() || undefined,
    requestSectionGid: body.requestSectionGid?.trim() || undefined,
    workspaceGid: body.workspaceGid?.trim() || undefined,
  };
}

async function upsertBrandUser(input: {
  tenantId: string;
  email: string;
  password: string;
  brandName: string;
  brandCode: string;
}, options: { updateExistingPassword?: boolean } = {}): Promise<{ uid: string; password: string; created: boolean }> {
  const auth = getAdminAuth();
  const displayName = `${input.brandName} Yetkili`;
  const updateExistingPassword = options.updateExistingPassword ?? true;

  try {
    const existing = await auth.getUserByEmail(input.email);
    await auth.updateUser(existing.uid, {
      ...(updateExistingPassword ? { password: input.password } : {}),
      displayName,
      emailVerified: true,
      disabled: false,
    });
    await auth.setCustomUserClaims(existing.uid, {
      role: "brand_user",
      tenantId: input.tenantId,
      brandCode: input.brandCode,
    });
    return { uid: existing.uid, password: input.password, created: false };
  } catch (error) {
    const code = (error as { code?: string } | null)?.code ?? "";
    if (code !== "auth/user-not-found") throw error;
  }

  const created = await auth.createUser({
    email: input.email,
    password: input.password,
    displayName,
    emailVerified: true,
    disabled: false,
  });
  await auth.setCustomUserClaims(created.uid, {
    role: "brand_user",
    tenantId: input.tenantId,
    brandCode: input.brandCode,
  });
  return { uid: created.uid, password: input.password, created: true };
}

async function resolveAsanaMapping(payload: CreateTenantBody) {
  const providedProjectGids = parseCsv(payload.projectGids);
  const workspaceGid = payload.workspaceGid?.trim() || getAsanaEnv().workspaceGid || "";

  if (providedProjectGids.length > 0) {
    return {
      workspaceGid: workspaceGid || undefined,
      projectGids: providedProjectGids,
      requestProjectGid: payload.requestProjectGid ?? providedProjectGids[0],
      requestSectionGid: payload.requestSectionGid,
    };
  }

  if (!workspaceGid) {
    throw new TenantAccessError("Workspace seçilmedi", 400);
  }

  const lookup = await lookupBrandInWorkspace({
    workspaceGid,
    brandCode: payload.brandCode,
  });

  if (lookup.projectGids.length === 0) {
    throw new TenantAccessError(
      "Asana içinde bu marka kodu için proje eşleşmesi bulunamadı",
      400,
    );
  }

  return {
    workspaceGid: lookup.workspaceGid,
    projectGids: lookup.projectGids,
    requestProjectGid: payload.requestProjectGid ?? lookup.request?.projectGid,
    requestSectionGid: payload.requestSectionGid ?? lookup.request?.sectionGid,
  };
}

function normalizeTenantPayload(
  payload: CreateTenantBody,
  mapping: Awaited<ReturnType<typeof resolveAsanaMapping>>,
): TenantAccess {
  const tenantId = slugTenantId(payload.brandName) || payload.brandCode.toLowerCase();
  return {
    tenantId,
    brandName: payload.brandName,
    emails: [payload.email],
    asana: {
      brandCode: payload.brandCode,
      projectGids: mapping.projectGids,
      requestProjectGid: mapping.requestProjectGid,
      requestSectionGid: mapping.requestSectionGid,
      workspaceGid: mapping.workspaceGid,
    },
  };
}

async function ensureDefaultSwatchloopTenant() {
  const bootstrapEnabled = readEnv("ENABLE_SWATCHLOOP_BOOTSTRAP") === "1";
  if (!bootstrapEnabled) return;

  const email = (readEnv("DEFAULT_SWATCHLOOP_EMAIL") ?? "swatchloop@gmail.com")
    .trim()
    .toLowerCase();
  const password = readEnv("DEFAULT_SWATCHLOOP_PASSWORD") ?? "swatch123";
  const brandName = readEnv("DEFAULT_SWATCHLOOP_BRAND_NAME") ?? "Swatchloop";
  const brandCode = (
    readEnv("DEFAULT_SWATCHLOOP_BRAND_CODE") ??
    readEnv("ASANA_BRAND_CODE") ??
    "SWH101"
  )
    .trim()
    .toUpperCase();
  const projectGids = parseCsv(
    readEnv("DEFAULT_SWATCHLOOP_PROJECT_GIDS") ?? readEnv("ASANA_PROJECT_GID"),
  );

  if (!email.includes("@") || password.length < 8 || projectGids.length === 0) return;

  const existing = await getTenantByEmail(email);
  if (existing) return;

  const payload = {
    brandName,
    brandCode,
    email,
    password,
    projectGids: projectGids.join(","),
    requestProjectGid:
      readEnv("DEFAULT_SWATCHLOOP_REQUEST_PROJECT_GID") ??
      readEnv("ASANA_REQUEST_PROJECT_GID") ??
      projectGids[0],
    requestSectionGid:
      readEnv("DEFAULT_SWATCHLOOP_REQUEST_SECTION_GID") ??
      readEnv("ASANA_REQUEST_SECTION_GID"),
    workspaceGid:
      readEnv("DEFAULT_SWATCHLOOP_WORKSPACE_GID") ?? readEnv("ASANA_WORKSPACE_GID"),
  };
  const tenant = normalizeTenantPayload(payload, {
    workspaceGid: payload.workspaceGid,
    projectGids,
    requestProjectGid: payload.requestProjectGid,
    requestSectionGid: payload.requestSectionGid,
  });

  await upsertTenant(tenant);
  await upsertBrandUser(
    {
      tenantId: tenant.tenantId,
      email,
      password,
      brandName: tenant.brandName,
      brandCode: tenant.asana.brandCode,
    },
    { updateExistingPassword: true },
  );
}

export async function GET(request: Request) {
  try {
    await requireAdminAccess(request);
    await ensureDefaultSwatchloopTenant();
    const tenants = await listTenantDirectory();
    return NextResponse.json({ tenants });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Failed to list tenants";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    await requireAdminAccess(request);
    const body = parseBody(await request.json());
    const mapping = await resolveAsanaMapping(body);
    const tenant = normalizeTenantPayload(body, mapping);
    await upsertTenant(tenant);
    const user = await upsertBrandUser({
      tenantId: tenant.tenantId,
      email: body.email,
      password: body.password,
      brandName: tenant.brandName,
      brandCode: tenant.asana.brandCode,
    });

    return NextResponse.json({
      ok: true,
      tenant,
      user: {
        uid: user.uid,
        email: body.email,
        password: user.password,
        created: user.created,
      },
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const code = (error as { code?: string } | null)?.code ?? "";
    if (code) {
      return NextResponse.json({ error: code }, { status: 400 });
    }
    const message = error instanceof Error ? error.message : "Failed to create tenant";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
