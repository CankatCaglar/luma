import { after, NextResponse } from "next/server";
import { getAsanaEnv } from "@/lib/asana/config";
import { lookupBrandInWorkspace } from "@/lib/asana/lookup";
import { warmupTenantJobs } from "@/lib/data/jobs";
import { probeDriveFolder } from "@/lib/drive/client";
import {
  driveConfigFromFields,
  type DriveUrlFields,
} from "@/lib/drive/parse";
import {
  isValidPortalUsername,
  normalizePortalUsername,
  portalEmailFromUsername,
} from "@/lib/auth/portalLogin";
import { getAdminAuth } from "@/lib/firebase/admin";
import {
  deleteTenant,
  getPortalUsername,
  getTenantById,
  listTenantDirectory,
  slugTenantId,
  updateTenantContactEmail,
  updateTenantDrive,
  updateTenantPortalPassword,
  upsertTenant,
  type TenantAccess,
} from "@/lib/tenant/access";
import { requireAdminAccess } from "@/lib/tenant/requireAdmin";
import { TenantAccessError } from "@/lib/tenant/requireTenant";

type CreateTenantBody = {
  brandName: string;
  brandCode: string;
  username: string;
  email: string;
  contactEmail?: string;
  password: string;
  projectGids: string;
  requestProjectGid?: string;
  requestSectionGid?: string;
  workspaceGid?: string;
  rootUrl?: string;
  logoUrl?: string;
  briefUrl?: string;
  competitorUrl?: string;
  plansFolderUrl?: string;
  planUrlsText?: string;
};

function parseCsv(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(/[,\s]+/).map((part) => part.trim()).filter(Boolean))];
}

function createTempPassword(): string {
  const random = Math.random().toString(36).slice(2, 10);
  return `Luma!${random}9`;
}

function parseOptionalContactEmail(value: string | undefined): string | undefined {
  const contactEmail = value?.trim().toLowerCase() ?? "";
  if (!contactEmail) return undefined;
  if (!contactEmail.includes("@")) {
    throw new TenantAccessError("Geçerli bir iletişim e-postası girin", 400);
  }
  return contactEmail;
}

function parseBody(input: unknown): CreateTenantBody {
  if (!input || typeof input !== "object") {
    throw new TenantAccessError("Invalid payload", 400);
  }
  const body = input as Partial<CreateTenantBody> & { username?: string };
  const brandName = body.brandName?.trim() ?? "";
  const brandCode = body.brandCode?.trim().toUpperCase() ?? "";
  const rawUsername = body.username?.trim() || "";
  const legacyEmail = body.email?.trim().toLowerCase() ?? "";
  const username = rawUsername
    ? normalizePortalUsername(rawUsername)
    : legacyEmail.includes("@")
      ? normalizePortalUsername(legacyEmail.split("@")[0] ?? "")
      : normalizePortalUsername(legacyEmail);
  const email = rawUsername
    ? portalEmailFromUsername(username)
    : legacyEmail.includes("@")
      ? legacyEmail
      : username
        ? portalEmailFromUsername(username)
        : "";
  const contactEmail = parseOptionalContactEmail(body.contactEmail);
  const projectGids = body.projectGids?.trim() ?? "";
  const password = body.password?.trim() || createTempPassword();

  if (brandName.length < 2) {
    throw new TenantAccessError("Brand name is required", 400);
  }
  if (brandCode.length < 2) {
    throw new TenantAccessError("Brand code is required", 400);
  }
  if (!isValidPortalUsername(username)) {
    throw new TenantAccessError(
      "Kullanıcı adı 2-32 karakter olmalı; harf, rakam, nokta, _ ve - kullanılabilir.",
      400,
    );
  }
  if (!email.includes("@")) {
    throw new TenantAccessError("Giriş e-postası oluşturulamadı", 400);
  }
  if (password.length < 8) {
    throw new TenantAccessError("Password must be at least 8 chars", 400);
  }

  return {
    brandName,
    brandCode,
    username,
    email,
    contactEmail,
    password,
    projectGids,
    requestProjectGid: body.requestProjectGid?.trim() || undefined,
    requestSectionGid: body.requestSectionGid?.trim() || undefined,
    workspaceGid: body.workspaceGid?.trim() || undefined,
    rootUrl: body.rootUrl?.trim() || undefined,
    logoUrl: body.logoUrl?.trim() || undefined,
    briefUrl: body.briefUrl?.trim() || undefined,
    competitorUrl: body.competitorUrl?.trim() || undefined,
    plansFolderUrl: body.plansFolderUrl?.trim() || undefined,
    planUrlsText: body.planUrlsText?.trim() || undefined,
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
      brandName: input.brandName,
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
    brandName: input.brandName,
  });
  return { uid: created.uid, password: input.password, created: true };
}

function driveFieldsFromBody(body: DriveUrlFields): DriveUrlFields {
  return {
    rootUrl: body.rootUrl?.trim() || undefined,
    logoUrl: body.logoUrl?.trim() || undefined,
    briefUrl: body.briefUrl?.trim() || undefined,
    competitorUrl: body.competitorUrl?.trim() || undefined,
    plansFolderUrl: body.plansFolderUrl?.trim() || undefined,
    planUrlsText: body.planUrlsText?.trim() || undefined,
  };
}

async function driveAccessCheck(tenant: TenantAccess) {
  const root = tenant.drive?.rootFolderId
    ? await probeDriveFolder(tenant.drive.rootFolderId)
    : undefined;
  const plans = tenant.drive?.plansFolderId
    ? await probeDriveFolder(tenant.drive.plansFolderId)
    : undefined;
  return { root, plans };
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
    contactEmail: payload.contactEmail,
    portalUsername: payload.username,
    portalPassword: payload.password,
    asana: {
      brandCode: payload.brandCode,
      projectGids: mapping.projectGids,
      requestProjectGid: mapping.requestProjectGid,
      requestSectionGid: mapping.requestSectionGid,
      workspaceGid: mapping.workspaceGid,
    },
    drive: driveConfigFromFields(driveFieldsFromBody(payload)),
  };
}

export async function GET(request: Request) {
  try {
    await requireAdminAccess(request);
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

    const directory = await listTenantDirectory();
    if (directory.some((tenant) => tenant.emails.includes(body.email))) {
      throw new TenantAccessError(
        "Bu kullanıcı adı / giriş e-postası zaten kayıtlı bir markaya ait.",
        409,
      );
    }
    if (
      directory.some((tenant) => getPortalUsername(tenant) === body.username)
    ) {
      throw new TenantAccessError("Bu kullanıcı adı zaten kullanılıyor.", 409);
    }
    if (directory.some((tenant) => tenant.asana.brandCode === body.brandCode)) {
      throw new TenantAccessError(
        "Bu marka kodu zaten kayıtlı.",
        409,
      );
    }

    const auth = getAdminAuth();
    try {
      await auth.getUserByEmail(body.email);
      throw new TenantAccessError(
        "Bu kullanıcı adı zaten bir giriş hesabına kayıtlı.",
        409,
      );
    } catch (error) {
      const code = (error as { code?: string } | null)?.code ?? "";
      if (code !== "auth/user-not-found") throw error;
    }

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

    after(() =>
      warmupTenantJobs({
        tenantId: tenant.tenantId,
        brandName: tenant.brandName,
        brandCode: tenant.asana.brandCode,
        email: body.email,
        projectGids: tenant.asana.projectGids,
        workspaceGid: tenant.asana.workspaceGid,
        drive: tenant.drive,
      }),
    );

    const driveCheck = tenant.drive ? await driveAccessCheck(tenant) : undefined;

    return NextResponse.json({
      ok: true,
      tenant,
      driveCheck,
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

export async function PATCH(request: Request) {
  try {
    await requireAdminAccess(request);
    const body = (await request.json()) as {
      tenantId?: string;
      contactEmail?: string;
      password?: string;
      rootUrl?: string;
      logoUrl?: string;
      briefUrl?: string;
      competitorUrl?: string;
      plansFolderUrl?: string;
      planUrlsText?: string;
    };
    const tenantId = body.tenantId?.trim() ?? "";
    if (!tenantId) {
      throw new TenantAccessError("Marka seçilmedi", 400);
    }

    const updatingDrive = "rootUrl" in body;
    const updatingContact = "contactEmail" in body;
    const updatingPassword = "password" in body;
    if (!updatingDrive && !updatingContact && !updatingPassword) {
      throw new TenantAccessError("Güncellenecek alan yok", 400);
    }

    let tenant = null as Awaited<ReturnType<typeof updateTenantDrive>>;
    if (updatingDrive) {
      const drive = driveConfigFromFields(driveFieldsFromBody(body));
      tenant = await updateTenantDrive(tenantId, drive);
    }
    if (updatingContact) {
      tenant = await updateTenantContactEmail(
        tenantId,
        parseOptionalContactEmail(body.contactEmail),
      );
    }
    if (updatingPassword) {
      const password = body.password?.trim() ?? "";
      if (password.length < 8) {
        throw new TenantAccessError("Şifre en az 8 karakter olmalı", 400);
      }
      const current = tenant ?? (await getTenantById(tenantId));
      if (!current) {
        throw new TenantAccessError("Marka bulunamadı", 404);
      }
      const email = current.emails[0];
      if (!email) {
        throw new TenantAccessError("Bu markanın giriş e-postası yok", 400);
      }
      await upsertBrandUser({
        tenantId: current.tenantId,
        email,
        password,
        brandName: current.brandName,
        brandCode: current.asana.brandCode,
      });
      tenant = (await updateTenantPortalPassword(tenantId, password)) ?? {
        ...current,
        portalPassword: password,
      };
    }
    if (!tenant) {
      throw new TenantAccessError("Marka bulunamadı", 404);
    }

    if (updatingDrive || updatingContact) {
      after(() =>
        warmupTenantJobs({
          tenantId: tenant.tenantId,
          brandName: tenant.brandName,
          brandCode: tenant.asana.brandCode,
          email: tenant.emails[0] ?? "",
          projectGids: tenant.asana.projectGids,
          workspaceGid: tenant.asana.workspaceGid,
          drive: tenant.drive,
        }),
      );
    }

    const driveCheck = await driveAccessCheck(tenant);
    return NextResponse.json({ ok: true, tenant, driveCheck });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Drive bilgisi kaydedilemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    await requireAdminAccess(request);
    const tenantId = new URL(request.url).searchParams.get("tenantId")?.trim() ?? "";
    if (!tenantId) {
      throw new TenantAccessError("Marka seçilmedi", 400);
    }

    const tenant = await deleteTenant(tenantId);
    if (!tenant) {
      throw new TenantAccessError("Marka bulunamadı", 404);
    }

    const auth = getAdminAuth();
    for (const email of tenant.emails) {
      try {
        const existing = await auth.getUserByEmail(email);
        const role = (existing.customClaims as { role?: string } | undefined)?.role;
        if (role === "admin") continue;
        await auth.deleteUser(existing.uid);
      } catch (error) {
        const code = (error as { code?: string } | null)?.code ?? "";
        if (code !== "auth/user-not-found") throw error;
      }
    }

    return NextResponse.json({
      ok: true,
      tenantId: tenant.tenantId,
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Marka silinemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
