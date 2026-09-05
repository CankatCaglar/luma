"use client";

import { Fragment, useCallback, useEffect, useId, useMemo, useState, type ReactNode } from "react";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LumaLogo, LumaStar } from "@/components/layout/NeraLogo";
import { firebaseAuth, firebaseEnabled } from "@/lib/firebase/client";

type DriveStatus = {
  configured: boolean;
  apiOk: boolean;
  email?: string;
  source?: "drive_json" | "drive_file" | "firebase_admin";
  error?: string;
  shareHint?: string;
};

type DriveForm = {
  rootUrl: string;
};

type Tenant = {
  tenantId: string;
  brandName: string;
  emails: string[];
  contactEmail?: string;
  asana: {
    brandCode: string;
    projectGids: string[];
    requestProjectGid?: string;
    requestSectionGid?: string;
  };
  drive?: {
    rootUrl?: string;
  };
};

type AsanaWorkspaceOption = {
  gid: string;
  name: string;
};

type BrandLookup = {
  brandCode: string;
  found: boolean;
  taskCount: number;
  projects: Array<{ gid: string; name: string; taskCount: number }>;
  projectGids: string[];
  request?: {
    projectGid: string;
    projectName: string;
    sectionGid?: string;
    sectionName?: string;
  };
  usedWorkspaceDefaults: boolean;
};

type LookupResponse = {
  error?: string;
  workspaceGid?: string;
  workspaceName?: string | null;
  workspaces?: AsanaWorkspaceOption[];
  brandCode?: string;
  found?: boolean;
  taskCount?: number;
  projects?: BrandLookup["projects"];
  projectGids?: string[];
  request?: BrandLookup["request"];
  usedWorkspaceDefaults?: boolean;
};

type FormState = {
  brandName: string;
  brandCode: string;
  email: string;
  contactEmail: string;
  password: string;
  workspaceGid: string;
} & DriveForm;

const EMPTY_DRIVE: DriveForm = {
  rootUrl: "",
};

const INITIAL_FORM: FormState = {
  brandName: "",
  brandCode: "",
  email: "",
  contactEmail: "",
  password: "",
  workspaceGid: "",
  ...EMPTY_DRIVE,
};

const fieldClassName =
  "w-full min-w-0 max-w-full rounded-xl border border-luma-border bg-white px-3 py-3 text-base text-foreground outline-none placeholder:text-luma-muted focus:ring-2 focus:ring-luma";

function firebaseErrorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: string }).code)
    : "";
}

function adminLoginErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message === "Bu hesap admin paneline yetkili değil.") {
    return error.message;
  }
  const code = firebaseErrorCode(error);
  switch (code) {
    case "auth/invalid-credential":
    case "auth/user-not-found":
    case "auth/wrong-password":
      return "Admin e-posta veya şifre hatalı.";
    case "auth/user-disabled":
      return "Bu admin hesabı devre dışı.";
    case "auth/too-many-requests":
      return "Çok fazla deneme yapıldı. Lütfen biraz sonra tekrar deneyin.";
    case "auth/network-request-failed":
      return "Bağlantı hatası oluştu. İnternetinizi kontrol edip tekrar deneyin.";
    case "auth/operation-not-allowed":
      return "Firebase tarafında Email/Password girişi aktif değil.";
    case "auth/configuration-not-found":
      return "Firebase Authentication ayarları eksik görünüyor.";
    default:
      return "Admin girişi başarısız oldu. E-posta/şifreyi kontrol edip tekrar deneyin.";
  }
}

function tenantHasDrive(tenant: Tenant): boolean {
  const drive = tenant.drive;
  if (!drive) return false;
  return Boolean(drive.rootUrl);
}

function driveFormFromTenant(tenant: Tenant): DriveForm {
  return {
    rootUrl: tenant.drive?.rootUrl ?? "",
  };
}

function formatDriveCheck(check: {
  root?: { ok: boolean; name?: string; error?: string };
  plans?: { ok: boolean; name?: string; error?: string };
} | null): string | null {
  if (!check) return null;
  const parts: string[] = [];
  if (check.root) {
    parts.push(
      check.root.ok
        ? `Kutu: ${check.root.name ?? "erişildi"}`
        : `Kutu: ${check.root.error ?? "erişilemedi"}`,
    );
  }
  if (check.plans) {
    parts.push(
      check.plans.ok
        ? `Planlar: ${check.plans.name ?? "erişildi"}`
        : `Planlar: ${check.plans.error ?? "erişilemedi"}`,
    );
  }
  return parts.length ? parts.join(" · ") : null;
}

export default function AdminPage() {
  const router = useRouter();
  const { enabled, user, isAdmin, adminChecking, signOutUser } = useAuth();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [adminLoggingIn, setAdminLoggingIn] = useState(false);
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [rememberAdmin, setRememberAdmin] = useState(false);
  const [adminSigningOut, setAdminSigningOut] = useState(false);
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [adminReady, setAdminReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [driveDraft, setDriveDraft] = useState<DriveForm>(EMPTY_DRIVE);
  const [savingDriveId, setSavingDriveId] = useState<string | null>(null);
  const [driveStatus, setDriveStatus] = useState<DriveStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [workspaceOptions, setWorkspaceOptions] = useState<AsanaWorkspaceOption[]>([]);
  const [workspacesLoading, setWorkspacesLoading] = useState(false);
  const [lookup, setLookup] = useState<BrandLookup | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const canSubmit = useMemo(
    () =>
      form.brandName.trim().length >= 2 &&
      form.brandCode.trim().length >= 2 &&
      form.email.includes("@") &&
      form.contactEmail.includes("@") &&
      Boolean(form.workspaceGid) &&
      (lookup?.projectGids.length ?? 0) > 0 &&
      lookup?.brandCode === form.brandCode.trim().toUpperCase(),
    [form, lookup],
  );

  const authHeaders = useCallback(async (): Promise<Record<string, string>> => {
    if (enabled && user) {
      const token = await user.getIdToken();
      return { Authorization: `Bearer ${token}` };
    }
    return {};
  }, [enabled, user]);

  const loadTenants = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/admin/tenants", {
        cache: "no-store",
        headers: (await authHeaders()) as HeadersInit,
      });
      const payload = (await response.json().catch(() => null)) as
        | { error?: string; tenants?: Tenant[] }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Tenant listesi alınamadı");
      }
      setTenants(payload?.tenants ?? []);
    } catch (error) {
      setError(error instanceof Error ? error.message : "İşlem başarısız");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  const loadDriveStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/drive/status", {
        cache: "no-store",
        headers: (await authHeaders()) as HeadersInit,
      });
      const payload = (await response.json().catch(() => null)) as DriveStatus | null;
      if (!response.ok || !payload) return;
      setDriveStatus(payload);
    } catch {
      /* banner email optional */
    }
  }, [authHeaders]);

  const loadWorkspaces = useCallback(async () => {
    setWorkspacesLoading(true);
    setLookupError(null);
    try {
      const response = await fetch("/api/admin/asana/lookup", {
        cache: "no-store",
        headers: (await authHeaders()) as HeadersInit,
      });
      const payload = (await response.json().catch(() => null)) as LookupResponse | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Asana workspace listesi alınamadı");
      }
      const workspaces = payload?.workspaces ?? [];
      const fallbackWorkspace = payload?.workspaceGid ?? workspaces[0]?.gid ?? "";
      setWorkspaceOptions(workspaces);
      setForm((prev) => {
        const stillSelected = workspaces.some((workspace) => workspace.gid === prev.workspaceGid);
        return {
          ...prev,
          workspaceGid: stillSelected ? prev.workspaceGid : fallbackWorkspace,
        };
      });
    } catch (error) {
      setLookupError(error instanceof Error ? error.message : "Asana workspace alınamadı");
    } finally {
      setWorkspacesLoading(false);
    }
  }, [authHeaders]);

  const runLookup = useCallback(
    async (workspaceGid: string, brandCode: string) => {
      setLookupLoading(true);
      setLookupError(null);
      try {
        const query = new URLSearchParams({
          workspaceGid,
          brandCode,
        });
        const response = await fetch(`/api/admin/asana/lookup?${query.toString()}`, {
          cache: "no-store",
          headers: (await authHeaders()) as HeadersInit,
        });
        const payload = (await response.json().catch(() => null)) as LookupResponse | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? "Asana eşleşmesi alınamadı");
        }
        setLookup({
          brandCode: payload?.brandCode ?? brandCode,
          found: Boolean(payload?.found),
          taskCount: payload?.taskCount ?? 0,
          projects: payload?.projects ?? [],
          projectGids: payload?.projectGids ?? [],
          request: payload?.request,
          usedWorkspaceDefaults: Boolean(payload?.usedWorkspaceDefaults),
        });
      } catch (error) {
        setLookup(null);
        setLookupError(error instanceof Error ? error.message : "Asana eşleşmesi alınamadı");
      } finally {
        setLookupLoading(false);
      }
    },
    [authHeaders],
  );

  useEffect(() => {
    if (!(enabled && user && isAdmin)) {
      const reset = window.setTimeout(() => {
        setAdminReady(false);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    if (adminReady) {
      return;
    }
    const kickoff = window.setTimeout(() => {
      void Promise.all([loadTenants(), loadWorkspaces(), loadDriveStatus()]).finally(() => {
        setAdminReady(true);
      });
    }, 0);
    return () => window.clearTimeout(kickoff);
  }, [enabled, user, isAdmin, adminReady, loadTenants, loadWorkspaces, loadDriveStatus]);

  useEffect(() => {
    if (!adminReady) return;
    const code = form.brandCode.trim().toUpperCase();
    if (!form.workspaceGid || code.length < 3) {
      const reset = window.setTimeout(() => {
        setLookup(null);
        setLookupError(null);
      }, 0);
      return () => window.clearTimeout(reset);
    }

    const timer = window.setTimeout(() => {
      void runLookup(form.workspaceGid, code);
    }, 450);
    return () => window.clearTimeout(timer);
  }, [adminReady, form.brandCode, form.workspaceGid, runLookup]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit || !lookup) return;
    const email = form.email.trim().toLowerCase();
    const brandCode = form.brandCode.trim().toUpperCase();
    if (tenants.some((tenant) => tenant.emails.some((item) => item.toLowerCase() === email))) {
      setError("Bu e-posta zaten kayıtlı bir markaya ait.");
      setSuccess(null);
      return;
    }
    if (tenants.some((tenant) => tenant.asana.brandCode === brandCode)) {
      setError("Bu marka kodu zaten kayıtlı.");
      setSuccess(null);
      return;
    }
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const response = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: headers as HeadersInit,
        body: JSON.stringify({
          brandName: form.brandName,
          brandCode: form.brandCode,
          email: form.email,
          contactEmail: form.contactEmail,
          password: form.password,
          workspaceGid: form.workspaceGid,
          projectGids: lookup.projectGids.join(","),
          requestProjectGid: lookup.request?.projectGid,
          requestSectionGid: lookup.request?.sectionGid,
          rootUrl: form.rootUrl,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            user?: { email: string; password: string; created: boolean };
            tenant?: { brandName: string; tenantId: string };
            driveCheck?: {
              root?: { ok: boolean; name?: string; error?: string };
              plans?: { ok: boolean; name?: string; error?: string };
            };
          }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Tenant oluşturulamadı");
      }
      const created = payload?.user?.created ? "oluşturuldu" : "güncellendi";
      const driveNote = formatDriveCheck(payload?.driveCheck ?? null);
      setSuccess(
        `${payload?.tenant?.brandName ?? "Marka"} kaydedildi. Kullanıcı ${created}: ${payload?.user?.email}${driveNote ? ` · ${driveNote}` : ""}`,
      );
      setForm((prev) => ({
        ...INITIAL_FORM,
        workspaceGid: prev.workspaceGid,
      }));
      setLookup(null);
      await loadTenants();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Kaydetme başarısız");
    } finally {
      setSaving(false);
    }
  }

  const closeDeleteConfirm = useCallback(() => {
    if (deletingId) return;
    setTenantToDelete(null);
  }, [deletingId]);

  async function onDeleteTenant(tenant: Tenant) {
    setDeletingId(tenant.tenantId);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(
        `/api/admin/tenants?tenantId=${encodeURIComponent(tenant.tenantId)}`,
        {
          method: "DELETE",
          cache: "no-store",
          headers: (await authHeaders()) as HeadersInit,
        },
      );
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Marka silinemedi");
      }
      setTenants((prev) => prev.filter((item) => item.tenantId !== tenant.tenantId));
      setSuccess(`${tenant.brandName} silindi.`);
      setTenantToDelete(null);
      await loadTenants();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Marka silinemedi");
    } finally {
      setDeletingId(null);
    }
  }

  function onEditDrive(tenant: Tenant) {
    setEditingId((current) => (current === tenant.tenantId ? null : tenant.tenantId));
    setDriveDraft(driveFormFromTenant(tenant));
    setError(null);
    setSuccess(null);
  }

  async function onSaveDrive(tenant: Tenant) {
    setSavingDriveId(tenant.tenantId);
    setError(null);
    setSuccess(null);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const response = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: headers as HeadersInit,
        body: JSON.stringify({
          tenantId: tenant.tenantId,
          ...driveDraft,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        tenant?: Tenant;
        driveCheck?: {
          root?: { ok: boolean; name?: string; error?: string };
          plans?: { ok: boolean; name?: string; error?: string };
        };
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Drive bilgisi kaydedilemedi");
      }
      if (payload?.tenant) {
        setTenants((prev) =>
          prev.map((item) => (item.tenantId === tenant.tenantId ? payload.tenant! : item)),
        );
      }
      const driveNote = formatDriveCheck(payload?.driveCheck ?? null);
      setSuccess(
        `${tenant.brandName} Drive bilgileri kaydedildi${driveNote ? ` · ${driveNote}` : ""}`,
      );
      setEditingId(null);
      await loadTenants();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Drive bilgisi kaydedilemedi");
    } finally {
      setSavingDriveId(null);
    }
  }

  async function onAdminLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseAuth) return;
    setAdminLoginError(null);
    setAdminLoggingIn(true);
    try {
      await setPersistence(
        firebaseAuth,
        rememberAdmin ? browserLocalPersistence : browserSessionPersistence,
      );
      const credential = await signInWithEmailAndPassword(
        firebaseAuth,
        adminEmail.trim().toLowerCase(),
        adminPassword,
      );
      const token = await credential.user.getIdToken();
      const response = await fetch("/api/admin/session", {
        cache: "no-store",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      const payload = (await response.json().catch(() => null)) as
        | { isAdmin?: boolean; error?: string }
        | null;
      if (!response.ok || !payload?.isAdmin) {
        await signOutUser();
        throw new Error("Bu hesap admin paneline yetkili değil.");
      }
      setAdminPassword("");
    } catch (error) {
      setAdminLoginError(adminLoginErrorMessage(error));
    } finally {
      setAdminLoggingIn(false);
    }
  }

  const closeSignOutConfirm = useCallback(() => {
    if (adminSigningOut) return;
    setSignOutConfirmOpen(false);
  }, [adminSigningOut]);

  async function onSecureSignOut() {
    setAdminSigningOut(true);
    setError(null);
    setSuccess(null);
    try {
      await signOutUser();
      setSignOutConfirmOpen(false);
      router.replace("/admin");
    } finally {
      setAdminSigningOut(false);
    }
  }

  async function onLeaveToLuma() {
    setAdminSigningOut(true);
    setError(null);
    setSuccess(null);
    try {
      await signOutUser();
      router.replace("/giris");
    } finally {
      setAdminSigningOut(false);
    }
  }

  if (!firebaseEnabled || !enabled) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <section className="w-full min-w-0 max-w-md rounded-3xl bg-luma-gold-soft px-4 py-6 text-sm font-medium text-luma-kahve ring-1 ring-luma-border/80 sm:px-6">
          Admin paneli için Firebase Auth zorunlu. Lütfen `.env.local` değerlerini
          tamamlayın.
        </section>
      </div>
    );
  }

  if (adminChecking) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <section className="w-full min-w-0 max-w-md rounded-3xl bg-white px-4 py-6 text-sm text-luma-muted shadow-[0_16px_48px_rgba(28,25,23,0.08)] ring-1 ring-luma-border/80 sm:px-6">
          Admin yetkisi kontrol ediliyor...
        </section>
      </div>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="grid min-h-dvh min-w-0 overflow-x-clip lg:grid-cols-[minmax(0,1.05fr)_minmax(20rem,0.8fr)]">
        <section className="flex min-h-dvh min-w-0 flex-col px-4 py-6 sm:px-10 lg:px-16">
          <div className="flex flex-1 items-center justify-center py-10">
            <div className="w-full min-w-0 max-w-md">
              <div className="text-center">
                <div className="mb-6 flex justify-center">
                  <LumaLogo height={64} />
                </div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl lg:text-4xl">
                  Luma Admin
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-luma-muted">
                  Yönetim paneline giriş yapın.
                </p>
              </div>

              {user && !isAdmin ? (
                <div className="mt-4 rounded-xl bg-luma-gold-soft px-3 py-2 text-xs font-semibold text-luma-kahve">
                  Şu an farklı bir kullanıcı açık. Yönetici hesabı ile tekrar giriş yapın.
                </div>
              ) : null}

              <section className="mt-6 min-w-0 rounded-3xl bg-white px-4 pb-7 pt-5 shadow-[0_16px_48px_rgba(28,25,23,0.08)] ring-1 ring-luma-border/80 sm:px-6 sm:pb-8 sm:pt-6">
                <form className="space-y-3" onSubmit={onAdminLogin}>
                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-foreground">
                      E-posta
                    </span>
                    <span className="relative block">
                      <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-luma-muted" />
                      <input
                        required
                        type="email"
                        autoComplete="email"
                        value={adminEmail}
                        onChange={(event) => {
                          setAdminEmail(event.target.value);
                          setAdminLoginError(null);
                        }}
                        placeholder="E-posta adresi"
                        className={`${fieldClassName} pl-9`}
                      />
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-1 block text-sm font-medium text-foreground">
                      Şifre
                    </span>
                    <span className="relative block">
                      <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-luma-muted" />
                      <input
                        required
                        type={showAdminPassword ? "text" : "password"}
                        autoComplete="current-password"
                        value={adminPassword}
                        onChange={(event) => {
                          setAdminPassword(event.target.value);
                          setAdminLoginError(null);
                        }}
                        placeholder="Şifre"
                        className={`${fieldClassName} pl-9 pr-10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowAdminPassword((value) => !value)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-luma transition-transform duration-150 ease-out active:scale-[0.95]"
                        aria-label={showAdminPassword ? "Şifreyi gizle" : "Şifreyi göster"}
                      >
                        {showAdminPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </span>
                  </label>

                  <label className="flex cursor-pointer select-none items-center gap-2.5 px-0.5 text-sm text-foreground">
                    <input
                      type="checkbox"
                      checked={rememberAdmin}
                      onChange={(event) => setRememberAdmin(event.target.checked)}
                      className="h-4 w-4 shrink-0 rounded border-luma-border text-luma accent-luma focus:ring-luma"
                    />
                    Beni Hatırla
                  </label>

                  {adminLoginError ? (
                    <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-luma-red">
                      {adminLoginError}
                    </p>
                  ) : null}

                  <button
                    type="submit"
                    disabled={adminLoggingIn}
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-luma py-3 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {adminLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Giriş Yap
                  </button>
                </form>
              </section>
              <p className="mt-4 text-center text-xs text-luma-muted">
                LUMA by NERA © 2026
              </p>
            </div>
          </div>
        </section>

        <aside className="relative hidden overflow-hidden lg:block">
          <AdminLoginArtwork />
        </aside>
      </div>
    );
  }

  const activeWorkspaceName =
    workspaceOptions.find((workspace) => workspace.gid === form.workspaceGid)?.name ??
    "Workspace";

  return (
    <div className="w-full min-w-0 space-y-4 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:space-y-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="rounded-3xl bg-white px-4 py-4 shadow-[0_16px_48px_rgba(28,25,23,0.08)] ring-1 ring-luma-border/80 sm:px-6 sm:py-5">
        <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm text-luma-kahve">Tenant Admin</p>
            <h1 className="text-2xl font-bold tracking-tight break-words text-foreground sm:text-3xl">
              Marka Onboarding
            </h1>
            <p className="mt-1.5 text-sm leading-relaxed text-luma-muted">
              Marka kodunu yaz, Asana workspace&apos;inden eşleşmeyi otomatik bul.
            </p>
          </div>
          <div className="flex w-full min-w-0 items-stretch gap-2 sm:w-auto sm:items-center">
            <button
              type="button"
              onClick={() => void onLeaveToLuma()}
              disabled={adminSigningOut}
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl border border-luma-border px-2.5 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-luma-soft disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none sm:px-3 sm:py-2"
            >
              {adminSigningOut ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <ArrowLeft className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">Luma&apos;ya dön</span>
            </button>
            <button
              type="button"
              onClick={() => setSignOutConfirmOpen(true)}
              disabled={adminSigningOut}
              className="inline-flex min-w-0 flex-1 items-center justify-center gap-1.5 rounded-xl bg-luma px-2.5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70 sm:flex-none sm:px-3 sm:py-2"
            >
              {adminSigningOut ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4 shrink-0" />
              )}
              <span className="truncate">Güvenli çıkış</span>
            </button>
          </div>
        </div>
      </header>

      <DriveStatusBanner status={driveStatus} />

      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[minmax(22rem,34rem)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-3xl bg-white p-4 shadow-[0_16px_48px_rgba(28,25,23,0.08)] ring-1 ring-luma-border/80 sm:p-5">
          <h2 className="mb-1 text-base font-bold text-foreground">Yeni Marka Tanımla</h2>
          <p className="mb-4 text-sm leading-relaxed text-luma-muted">
            Proje veya section seçmene gerek yok. Marka kodu seçili workspace içinde aranır.
          </p>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <WorkspacePicker
                workspaces={workspaceOptions}
                value={form.workspaceGid}
                label={activeWorkspaceName}
                loading={workspacesLoading}
                onChange={(workspaceGid) => {
                  setLookup(null);
                  setForm((prev) => ({ ...prev, workspaceGid }));
                }}
              />
              <button
                type="button"
                onClick={() => void loadWorkspaces()}
                disabled={workspacesLoading}
                className="inline-flex items-center gap-1.5 rounded-full bg-luma-soft px-2.5 py-1.5 text-xs font-semibold text-luma transition-transform duration-150 ease-out hover:bg-[#e4e0f8] active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {workspacesLoading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <RefreshCcw className="h-3.5 w-3.5" />
                )}
                Yenile
              </button>
            </div>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Marka kodu</span>
              <span className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-luma-muted" />
                <input
                  value={form.brandCode}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      brandCode: event.target.value.toUpperCase(),
                    }))
                  }
                  placeholder="Örn. ALT101"
                  className={`${fieldClassName} pl-9 pr-10`}
                />
                {lookupLoading ? (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-luma" />
                ) : lookup?.found ? (
                  <Check className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-luma-green" />
                ) : null}
              </span>
            </label>

            <LookupPreview
              brandCode={form.brandCode}
              loading={lookupLoading}
              error={lookupError}
              lookup={lookup}
            />

            <input
              value={form.brandName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, brandName: event.target.value }))
              }
              placeholder="Marka adı"
              className={fieldClassName}
            />
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              placeholder="Yetkili e-posta (giriş)"
              className={fieldClassName}
            />
            <label className="block">
              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contactEmail: event.target.value }))
                }
                placeholder="İletişim e-postası"
                className={fieldClassName}
              />
              <span className="mt-1 block text-xs leading-relaxed text-luma-muted">
                Uygulamadan gönderilecek mailler bu adrese gider. Giriş e-postasından farklı olabilir.
              </span>
            </label>
            <input
              type="text"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              placeholder="Şifre (boşsa otomatik üretilir)"
              className={fieldClassName}
            />
            <DriveFields
              value={form}
              onChange={(next) => setForm((prev) => ({ ...prev, ...next }))}
            />
            <button
              type="submit"
              disabled={saving || !canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-luma py-3 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Marka Ekle
            </button>
            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-luma-red">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-xl bg-luma-green-soft px-3 py-2 text-sm font-semibold text-luma-green">
                {success}
              </p>
            ) : null}
          </form>
        </section>

        <section className="min-w-0 rounded-3xl bg-white p-4 shadow-[0_16px_48px_rgba(28,25,23,0.08)] ring-1 ring-luma-border/80 sm:p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-bold text-foreground">Kayıtlı Markalar</h2>
            <button
              type="button"
              onClick={() => void loadTenants()}
              className="shrink-0 text-sm font-semibold text-luma"
            >
              Yenile
            </button>
          </div>
          {error ? (
            <p className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-luma-red">
              {error}
            </p>
          ) : null}
          {success ? (
            <p className="mb-3 rounded-xl bg-luma-green-soft px-3 py-2 text-sm font-semibold text-luma-green">
              {success}
            </p>
          ) : null}
          {loading ? (
            <p className="text-sm text-luma-muted">Yükleniyor...</p>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-luma-muted">Henüz tenant kaydı yok.</p>
          ) : (
            <div className="overflow-x-auto rounded-2xl ring-1 ring-luma-border/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-luma-soft text-luma-kahve">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Marka</th>
                    <th className="px-3 py-2 font-semibold">Kod</th>
                    <th className="px-3 py-2 font-semibold">Kullanıcı</th>
                    <th className="px-3 py-2 font-semibold">İletişim</th>
                    <th className="px-2 py-2 text-right font-semibold">
                      <span className="sr-only">İşlemler</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <Fragment key={tenant.tenantId}>
                      <tr className="border-t border-luma-border">
                        <td className="px-3 py-2.5 text-foreground">
                          <span className="block">{tenant.brandName}</span>
                          {tenantHasDrive(tenant) ? (
                            <span className="mt-0.5 inline-block text-[10px] font-semibold text-luma">
                              Drive bağlı
                            </span>
                          ) : (
                            <span className="mt-0.5 inline-block text-[10px] font-semibold text-luma-muted">
                              Drive yok
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-semibold text-luma">
                          {tenant.asana.brandCode}
                        </td>
                        <td className="min-w-0 px-3 py-2.5 break-all text-luma-muted">
                          {tenant.emails.join(", ")}
                        </td>
                        <td className="min-w-0 px-3 py-2.5 break-all text-luma-muted">
                          {tenant.contactEmail || "—"}
                        </td>
                        <td className="px-2 py-2.5 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditDrive(tenant)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-luma-muted transition-colors hover:bg-luma-soft hover:text-luma"
                              aria-label={`${tenant.brandName} Drive düzenle`}
                            >
                              <FolderOpen className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setTenantToDelete(tenant)}
                              disabled={deletingId === tenant.tenantId}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-luma-muted transition-colors hover:bg-red-50 hover:text-luma-red disabled:cursor-not-allowed disabled:opacity-60"
                              aria-label={`${tenant.brandName} markasını sil`}
                            >
                              {deletingId === tenant.tenantId ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                      {editingId === tenant.tenantId ? (
                        <tr className="border-t border-luma-border bg-luma-soft/60">
                          <td colSpan={5} className="px-3 py-3">
                            <p className="mb-2 text-xs font-semibold text-luma-kahve">
                              {tenant.brandName} Drive bağlantıları
                            </p>
                            <DriveFields value={driveDraft} onChange={setDriveDraft} />
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void onSaveDrive(tenant)}
                                disabled={savingDriveId === tenant.tenantId}
                                className="inline-flex items-center justify-center gap-2 rounded-xl bg-luma px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                              >
                                {savingDriveId === tenant.tenantId ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : null}
                                Kaydet
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingId(null)}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-luma-muted"
                              >
                                Vazgeç
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      <AdminConfirmDialog
        open={signOutConfirmOpen}
        busy={adminSigningOut}
        title="Emin misiniz?"
        description="Güvenli çıkış oturumu kapatır. Admin paneline dönmek için tekrar giriş yapmanız gerekir."
        confirmLabel="Çıkış yap"
        icon={<LogOut className="h-5 w-5" />}
        onCancel={closeSignOutConfirm}
        onConfirm={() => void onSecureSignOut()}
      />
      <AdminConfirmDialog
        open={Boolean(tenantToDelete)}
        busy={Boolean(deletingId)}
        title="Markayı silmek istiyor musunuz?"
        description={
          tenantToDelete
            ? `${tenantToDelete.brandName} (${tenantToDelete.asana.brandCode}) kalıcı olarak silinir. Giriş hesabı da kapanır.`
            : ""
        }
        confirmLabel="Markayı sil"
        tone="danger"
        icon={<Trash2 className="h-5 w-5" />}
        onCancel={closeDeleteConfirm}
        onConfirm={() => {
          if (tenantToDelete) void onDeleteTenant(tenantToDelete);
        }}
      />
    </div>
  );
}

function AdminConfirmDialog({
  open,
  busy,
  title,
  description,
  confirmLabel,
  tone = "primary",
  icon,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  tone?: "primary" | "danger";
  icon: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy, onCancel]);

  const titleId = useId();
  const descId = useId();
  const isDanger = tone === "danger";

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Kapat"
        className="absolute inset-0 bg-[#1c1917]/40 backdrop-blur-[2px]"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative w-full max-w-md rounded-3xl bg-white px-5 py-6 shadow-[0_24px_64px_rgba(28,25,23,0.16)] ring-1 ring-luma-border/80 sm:px-6"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-xl text-luma-muted transition-colors hover:bg-luma-soft hover:text-foreground disabled:opacity-60"
          aria-label="Vazgeç"
        >
          <X className="h-4 w-4" />
        </button>
        <div
          className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${
            isDanger ? "bg-red-50 text-luma-red" : "bg-luma-soft text-luma"
          }`}
        >
          {icon}
        </div>
        <h2
          id={titleId}
          className="mt-4 text-center text-xl font-bold tracking-tight text-foreground"
        >
          {title}
        </h2>
        <p id={descId} className="mt-2 text-center text-sm leading-relaxed text-luma-muted">
          {description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-luma-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-luma-soft disabled:cursor-not-allowed disabled:opacity-70"
          >
            Vazgeç
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70 ${
              isDanger ? "bg-luma-red" : "bg-luma"
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

function AdminLoginArtwork() {
  return (
    <div className="relative flex h-full min-h-screen items-center justify-center overflow-hidden bg-[linear-gradient(165deg,#4a49a8_0%,#6f6edc_46%,#945d3c_100%)]">
      <div className="relative aspect-square w-[94%]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 200 200" aria-hidden>
          <g fill="none" stroke="rgba(221,160,109,0.32)" strokeWidth="0.7">
            <circle cx="100" cy="100" r="99.5" />
            <circle cx="100" cy="100" r="76" />
            <circle cx="100" cy="100" r="53" />
          </g>
        </svg>
        <LumaStar className="absolute inset-0 z-10 h-full w-full drop-shadow-[0_0_36px_rgba(244,243,255,0.35)]" />
      </div>
    </div>
  );
}

function WorkspacePicker({
  workspaces,
  value,
  label,
  loading,
  onChange,
}: {
  workspaces: AsanaWorkspaceOption[];
  value: string;
  label: string;
  loading: boolean;
  onChange: (workspaceGid: string) => void;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative min-w-0 max-w-full">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label="Workspace"
        disabled={loading && workspaces.length === 0}
        onClick={() => setOpen((current) => !current)}
        className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-luma-soft py-1.5 pl-3 pr-2.5 text-sm font-semibold text-luma outline-none ring-1 ring-luma/20 transition-transform duration-150 ease-out hover:bg-[#e4e0f8] focus:ring-2 focus:ring-luma active:scale-[0.97] disabled:opacity-60"
      >
        <span className="max-w-[min(12rem,calc(100vw-8rem))] truncate">{label}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 shrink-0 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Workspace listesini kapat"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            className="absolute left-0 top-[calc(100%+8px)] z-50 w-[min(18rem,calc(100vw-2rem))] overflow-hidden rounded-2xl bg-white p-1.5 shadow-[0_12px_40px_rgba(28,25,23,0.12)] ring-1 ring-luma-border"
          >
            {workspaces.length === 0 ? (
              <li className="px-3 py-2 text-sm text-luma-muted">
                {loading ? "Workspace yükleniyor..." : "Workspace bulunamadı"}
              </li>
            ) : (
              workspaces.map((workspace) => {
                const selected = workspace.gid === value;
                return (
                  <li key={workspace.gid}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={selected}
                      onClick={() => {
                        onChange(workspace.gid);
                        setOpen(false);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm font-semibold transition-colors ${
                        selected
                          ? "bg-luma-soft text-luma"
                          : "text-foreground hover:bg-[#FBF9F5]"
                      }`}
                    >
                      <span className="truncate">{workspace.name}</span>
                      {selected ? <Check className="h-3.5 w-3.5 shrink-0" /> : null}
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function LookupPreview({
  brandCode,
  loading,
  error,
  lookup,
}: {
  brandCode: string;
  loading: boolean;
  error: string | null;
  lookup: BrandLookup | null;
}) {
  const code = brandCode.trim().toUpperCase();
  const stale = Boolean(lookup && lookup.brandCode !== code);

  if (error) {
    return (
      <p className="rounded-2xl bg-red-50 px-3 py-2.5 text-sm font-medium break-words text-luma-red">
        {error}
      </p>
    );
  }

  if (loading || (stale && code.length >= 3)) {
    return (
      <p className="rounded-2xl bg-luma-soft px-3 py-2.5 text-sm break-words text-luma">
        {code} Asana workspace&apos;inde aranıyor...
      </p>
    );
  }

  if (code.length < 3) {
    return (
      <p className="rounded-2xl bg-[#FBF9F5] px-3 py-2.5 text-sm text-luma-muted">
        Marka kodunu yaz, ilgili işler ve eşleşme otomatik gelsin.
      </p>
    );
  }

  if (!lookup) return null;

  if (lookup.found) {
    const projectNames = lookup.projects
      .filter((project) => project.taskCount > 0)
      .map((project) => project.name);
    const requestLabel = lookup.request
      ? [lookup.request.projectName, lookup.request.sectionName].filter(Boolean).join(" · ")
      : null;

    return (
      <div className="min-w-0 rounded-2xl bg-luma-green-soft px-3 py-3 text-sm break-words text-luma-green">
        <p className="font-semibold">
          {lookup.brandCode} bulundu · {lookup.taskCount} iş
        </p>
        {projectNames.length > 0 ? (
          <div className="mt-2 flex flex-wrap gap-1.5">
            {projectNames.map((name) => (
              <span
                key={name}
                className="max-w-full break-words rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-foreground"
              >
                {name}
              </span>
            ))}
          </div>
        ) : null}
        {requestLabel ? (
          <p className="mt-2 text-xs text-luma-kahve">Talepler: {requestLabel}</p>
        ) : null}
      </div>
    );
  }

  if (lookup.usedWorkspaceDefaults && lookup.projectGids.length > 0) {
    return (
      <div className="rounded-2xl bg-luma-gold-soft px-3 py-3 text-sm text-luma-kahve">
        <p className="font-semibold">{lookup.brandCode} için henüz iş yok</p>
        <p className="mt-1 text-xs">
          Workspace projeleri bağlanacak. Yeni işler bu kodla açılınca Luma&apos;da görünecek.
        </p>
      </div>
    );
  }

  return (
    <p className="rounded-2xl bg-red-50 px-3 py-2.5 text-sm font-medium text-luma-red">
      Bu kod Asana&apos;da bulunamadı. Marka kodunu kontrol et.
    </p>
  );
}

function DriveFields({
  value,
  onChange,
}: {
  value: DriveForm;
  onChange: (next: DriveForm) => void;
}) {
  function patch(partial: Partial<DriveForm>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="space-y-2">
      <p className="pt-1 text-xs font-semibold uppercase tracking-wide text-luma-kahve">
        Drive
      </p>
      <p className="text-xs leading-relaxed text-luma-muted">
        Kutuyu Firebase Admin e-postasına Viewer paylaş, linki buraya yapıştır. Logo, brief,
        rakip analizi ve aylık planlar klasörden otomatik gelir.
      </p>
      <input
        value={value.rootUrl}
        onChange={(event) => patch({ rootUrl: event.target.value })}
        placeholder="Genel Drive kutusu linki"
        className={fieldClassName}
      />
    </div>
  );
}

function DriveStatusBanner({ status }: { status: DriveStatus | null }) {
  const [copied, setCopied] = useState(false);
  const email = status?.email?.trim() ?? "";
  if (!email) return null;

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="rounded-3xl bg-luma-soft px-4 py-4 ring-1 ring-luma-border/80 sm:px-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-bold text-foreground">Drive paylaşım e-postası</p>
          <p className="mt-1 text-sm text-luma-muted">
            Bu adresi markanın Drive kutusuna Viewer ekle, sonra sağdaki klasör ikonuna kutu
            linkini kaydet.
          </p>
          <p className="mt-2 break-all font-mono text-xs text-foreground">{email}</p>
        </div>
        <button
          type="button"
          onClick={() => void copyEmail()}
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-foreground ring-1 ring-luma-border"
        >
          {copied ? <Check className="h-4 w-4 text-luma-green" /> : <Copy className="h-4 w-4" />}
          {copied ? "Kopyalandı" : "E-postayı kopyala"}
        </button>
      </div>
    </section>
  );
}
