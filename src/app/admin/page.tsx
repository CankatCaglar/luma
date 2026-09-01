"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
  Eye,
  EyeOff,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LumaLogo, LumaStar } from "@/components/layout/NeraLogo";
import { firebaseAuth, firebaseEnabled } from "@/lib/firebase/client";

type Tenant = {
  tenantId: string;
  brandName: string;
  emails: string[];
  asana: {
    brandCode: string;
    projectGids: string[];
    requestProjectGid?: string;
    requestSectionGid?: string;
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
  password: string;
  workspaceGid: string;
};

const INITIAL_FORM: FormState = {
  brandName: "",
  brandCode: "",
  email: "",
  password: "",
  workspaceGid: "",
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
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [adminReady, setAdminReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
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
      void Promise.all([loadTenants(), loadWorkspaces()]).finally(() => {
        setAdminReady(true);
      });
    }, 0);
    return () => window.clearTimeout(kickoff);
  }, [enabled, user, isAdmin, adminReady, loadTenants, loadWorkspaces]);

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
          password: form.password,
          workspaceGid: form.workspaceGid,
          projectGids: lookup.projectGids.join(","),
          requestProjectGid: lookup.request?.projectGid,
          requestSectionGid: lookup.request?.sectionGid,
        }),
      });
      const payload = (await response.json().catch(() => null)) as
        | {
            error?: string;
            user?: { email: string; password: string; created: boolean };
            tenant?: { brandName: string; tenantId: string };
          }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Tenant oluşturulamadı");
      }
      const created = payload?.user?.created ? "oluşturuldu" : "güncellendi";
      setSuccess(
        `${payload?.tenant?.brandName ?? "Marka"} kaydedildi. Kullanıcı ${created}: ${payload?.user?.email}`,
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

  async function onDeleteTenant(tenant: Tenant) {
    const confirmed = window.confirm(
      `${tenant.brandName} (${tenant.asana.brandCode}) markasını silmek istediğine emin misin? Giriş hesabı da kapanır.`,
    );
    if (!confirmed) return;

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
      await loadTenants();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Marka silinemedi");
    } finally {
      setDeletingId(null);
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

  async function onSecureSignOut() {
    setAdminSigningOut(true);
    setError(null);
    setSuccess(null);
    try {
      await signOutUser();
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
                  <LumaLogo className="h-16" />
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
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:space-y-6 sm:px-6 sm:py-8">
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
              onClick={() => void onSecureSignOut()}
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

      <div className="grid min-w-0 gap-4 sm:gap-6 lg:grid-cols-[1.1fr_1fr]">
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
              placeholder="Yetkili e-posta"
              className={fieldClassName}
            />
            <input
              type="text"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              placeholder="Şifre (boşsa otomatik üretilir)"
              className={fieldClassName}
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
            <div className="overflow-hidden rounded-2xl ring-1 ring-luma-border/80">
              <table className="w-full text-left text-sm">
                <thead className="bg-luma-soft text-luma-kahve">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Marka</th>
                    <th className="px-3 py-2 font-semibold">Kod</th>
                    <th className="px-3 py-2 font-semibold">Kullanıcı</th>
                    <th className="px-2 py-2 text-right font-semibold">
                      <span className="sr-only">Sil</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.tenantId} className="border-t border-luma-border">
                      <td className="px-3 py-2.5 text-foreground">{tenant.brandName}</td>
                      <td className="px-3 py-2.5 font-semibold text-luma">
                        {tenant.asana.brandCode}
                      </td>
                      <td className="min-w-0 px-3 py-2.5 break-all text-luma-muted">
                        {tenant.emails.join(", ")}
                      </td>
                      <td className="px-2 py-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => void onDeleteTenant(tenant)}
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
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
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
