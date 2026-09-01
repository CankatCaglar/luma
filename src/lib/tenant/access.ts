import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

export type TenantAsanaConfig = {
  workspaceGid?: string;
  projectGids: string[];
  brandCode: string;
  requestProjectGid?: string;
  requestSectionGid?: string;
};

export type TenantAccess = {
  tenantId: string;
  brandName: string;
  emails: string[];
  asana: TenantAsanaConfig;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function parseAsanaProjectGids(value: string | undefined): string[] {
  if (!value) return [];
  return [...new Set(value.split(/[,\s]+/).map((part) => part.trim()).filter(Boolean))];
}

function toTenantAccess(input: unknown): TenantAccess | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as Partial<TenantAccess> & {
    asana?: Partial<TenantAsanaConfig>;
    active?: boolean;
  };
  if (candidate.active === false) return null;
  const tenantId = candidate.tenantId?.trim();
  const brandName = candidate.brandName?.trim();
  const brandCode = candidate.asana?.brandCode?.trim().toUpperCase();
  const projectGids = (candidate.asana?.projectGids ?? [])
    .map((gid) => gid.trim())
    .filter(Boolean);
  const emails = (candidate.emails ?? []).map(normalizeEmail).filter(Boolean);
  if (!tenantId || !brandName || !brandCode || projectGids.length === 0 || emails.length === 0) {
    return null;
  }

  return {
    tenantId,
    brandName,
    emails,
    asana: {
      brandCode,
      projectGids,
      workspaceGid: candidate.asana?.workspaceGid?.trim() || undefined,
      requestProjectGid: candidate.asana?.requestProjectGid?.trim() || undefined,
      requestSectionGid: candidate.asana?.requestSectionGid?.trim() || undefined,
    },
  };
}

function parseTenantJson(): TenantAccess[] {
  const raw = readEnv("TENANT_ACCESS_JSON");
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => toTenantAccess(item))
      .filter((item): item is TenantAccess => item !== null);
  } catch {
    return [];
  }
}

function fallbackTenant(): TenantAccess | null {
  const brandCode = readEnv("ASANA_BRAND_CODE")?.toUpperCase();
  const projectGids = parseAsanaProjectGids(readEnv("ASANA_PROJECT_GID"));
  const allowedEmail = normalizeEmail(readEnv("DEFAULT_TENANT_EMAIL") ?? "");
  if (!brandCode || projectGids.length === 0 || !allowedEmail) return null;

  return {
    tenantId: readEnv("DEFAULT_TENANT_ID") ?? "default",
    brandName: readEnv("DEFAULT_TENANT_BRAND_NAME") ?? brandCode,
    emails: [allowedEmail],
    asana: {
      brandCode,
      projectGids,
      workspaceGid: readEnv("ASANA_WORKSPACE_GID"),
      requestProjectGid: readEnv("ASANA_REQUEST_PROJECT_GID"),
      requestSectionGid: readEnv("ASANA_REQUEST_SECTION_GID"),
    },
  };
}

export function getTenantDirectory(): TenantAccess[] {
  const tenants = parseTenantJson();
  if (tenants.length > 0) return tenants;
  const fallback = fallbackTenant();
  return fallback ? [fallback] : [];
}

function defaultCollectionName() {
  return readEnv("TENANTS_COLLECTION") ?? "tenants";
}

export async function listTenantDirectory(): Promise<TenantAccess[]> {
  try {
    const db = getAdminDb();
    const snapshot = await db.collection(defaultCollectionName()).get();
    return snapshot.docs
      .map((doc) =>
        toTenantAccess({
          tenantId: doc.id,
          ...doc.data(),
        }),
      )
      .filter((item): item is TenantAccess => item !== null)
      .sort((left, right) => left.brandName.localeCompare(right.brandName, "tr"));
  } catch {
    return getTenantDirectory();
  }
}

export async function getTenantByEmail(email: string): Promise<TenantAccess | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection(defaultCollectionName())
      .where("emails", "array-contains", normalized)
      .limit(1)
      .get();
    const first = snapshot.docs[0];
    if (first) {
      return (
        toTenantAccess({
          tenantId: first.id,
          ...first.data(),
        }) ?? null
      );
    }
  } catch {
    /* fallback below */
  }

  return (
    getTenantDirectory().find((tenant) => tenant.emails.includes(normalized)) ?? null
  );
}

export async function getTenantById(tenantId: string): Promise<TenantAccess | null> {
  const normalizedId = tenantId.trim();
  if (!normalizedId) return null;
  try {
    const db = getAdminDb();
    const snap = await db.collection(defaultCollectionName()).doc(normalizedId).get();
    if (!snap.exists) return null;
    return (
      toTenantAccess({
        tenantId: snap.id,
        ...snap.data(),
      }) ?? null
    );
  } catch {
    const list = getTenantDirectory();
    return list.find((tenant) => tenant.tenantId === normalizedId) ?? null;
  }
}

export async function getTenantByBrandCode(brandCode: string): Promise<TenantAccess | null> {
  const normalized = brandCode.trim().toUpperCase();
  if (!normalized) return null;
  try {
    const db = getAdminDb();
    const snapshot = await db
      .collection(defaultCollectionName())
      .where("asana.brandCode", "==", normalized)
      .limit(1)
      .get();
    const first = snapshot.docs[0];
    if (first) {
      return (
        toTenantAccess({
          tenantId: first.id,
          ...first.data(),
        }) ?? null
      );
    }
  } catch {
    /* fallback below */
  }

  return (
    getTenantDirectory().find((tenant) => tenant.asana.brandCode === normalized) ?? null
  );
}

export async function deleteTenant(tenantId: string): Promise<TenantAccess | null> {
  const existing = await getTenantById(tenantId);
  if (!existing) return null;

  const db = getAdminDb();
  await db.collection(defaultCollectionName()).doc(existing.tenantId).delete();
  return existing;
}

export async function upsertTenant(tenant: TenantAccess): Promise<void> {
  const db = getAdminDb();
  await db
    .collection(defaultCollectionName())
    .doc(tenant.tenantId)
    .set(
      {
        tenantId: tenant.tenantId,
        brandName: tenant.brandName,
        emails: [...new Set(tenant.emails.map(normalizeEmail))],
        asana: {
          brandCode: tenant.asana.brandCode.toUpperCase().trim(),
          projectGids: [...new Set(tenant.asana.projectGids.map((gid) => gid.trim()))],
          workspaceGid: tenant.asana.workspaceGid ?? null,
          requestProjectGid: tenant.asana.requestProjectGid ?? null,
          requestSectionGid: tenant.asana.requestSectionGid ?? null,
        },
        active: true,
        updatedAt: FieldValue.serverTimestamp(),
        createdAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
}

export function slugTenantId(brandName: string): string {
  return brandName
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}
