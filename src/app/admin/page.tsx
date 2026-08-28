"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Plus,
  RefreshCcw,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
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

type AsanaProjectOption = {
  gid: string;
  name: string;
};

type AsanaSectionOption = {
  gid: string;
  name: string;
};

type AsanaCatalogResponse = {
  error?: string;
  workspaceGid?: string | null;
  workspaces?: AsanaWorkspaceOption[];
  projects?: AsanaProjectOption[];
  sections?: AsanaSectionOption[];
  configured?: {
    workspaceGid?: string | null;
    projectGids?: string[];
    requestProjectGid?: string | null;
    requestSectionGid?: string | null;
  };
};

type FormState = {
  brandName: string;
  brandCode: string;
  email: string;
  password: string;
  projectGids: string;
  requestProjectGid: string;
  requestSectionGid: string;
  workspaceGid: string;
};

function firebaseErrorCode(error: unknown): string {
  return error && typeof error === "object" && "code" in error
    ? String((error as { code?: string }).code)
    : "";
}

function parseCsv(value: string): string[] {
  return [...new Set(value.split(/[,\s]+/).map((part) => part.trim()).filter(Boolean))];
}

function joinCsv(values: string[]): string {
  return [...new Set(values.map((item) => item.trim()).filter(Boolean))].join(",");
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

const INITIAL_FORM: FormState = {
  brandName: "",
  brandCode: "",
  email: "",
  password: "",
  projectGids: "",
  requestProjectGid: "",
  requestSectionGid: "",
  workspaceGid: "",
};

export default function AdminPage() {
  const router = useRouter();
  const { enabled, user, isAdmin, adminChecking, signOutUser } = useAuth();
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminLoginError, setAdminLoginError] = useState<string | null>(null);
  const [adminLoggingIn, setAdminLoggingIn] = useState(false);
  const [adminSigningOut, setAdminSigningOut] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [adminReady, setAdminReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [asanaLoading, setAsanaLoading] = useState(false);
  const [asanaError, setAsanaError] = useState<string | null>(null);
  const [workspaceOptions, setWorkspaceOptions] = useState<AsanaWorkspaceOption[]>([]);
  const [projectOptions, setProjectOptions] = useState<AsanaProjectOption[]>([]);
  const [sectionOptions, setSectionOptions] = useState<AsanaSectionOption[]>([]);
  const [selectedProjectGids, setSelectedProjectGids] = useState<string[]>([]);

  const canSubmit = useMemo(
    () =>
      form.brandName.trim().length >= 2 &&
      form.brandCode.trim().length >= 2 &&
      form.email.includes("@") &&
      form.projectGids.trim().length > 0,
    [form],
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

  const loadAsanaCatalog = useCallback(
    async (workspaceGid?: string, projectGid?: string) => {
      setAsanaLoading(true);
      setAsanaError(null);
      try {
        const query = new URLSearchParams();
        if (workspaceGid) query.set("workspaceGid", workspaceGid);
        if (projectGid) query.set("projectGid", projectGid);
        const queryString = query.toString();
        const response = await fetch(
          `/api/admin/asana/catalog${queryString ? `?${queryString}` : ""}`,
          {
            cache: "no-store",
            headers: (await authHeaders()) as HeadersInit,
          },
        );
        const payload = (await response.json().catch(() => null)) as AsanaCatalogResponse | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? "Asana katalog verisi alınamadı");
        }

        const workspaces = payload?.workspaces ?? [];
        const projects = payload?.projects ?? [];
        const sections = payload?.sections ?? [];
        const configuredProjectGids = payload?.configured?.projectGids ?? [];
        const activeWorkspace =
          workspaceGid ??
          payload?.workspaceGid ??
          payload?.configured?.workspaceGid ??
          workspaces[0]?.gid ??
          "";

        setWorkspaceOptions(workspaces);
        setProjectOptions(projects);
        setSectionOptions(sections);
        setForm((prev) => ({
          ...prev,
          workspaceGid: prev.workspaceGid || activeWorkspace,
        }));

        const currentFormProjects = parseCsv(form.projectGids);
        const source =
          currentFormProjects.length > 0 ? currentFormProjects : configuredProjectGids;
        const allowed = source.filter((gid) =>
          projects.some((project) => project.gid === gid),
        );
        if (allowed.length > 0) {
          setSelectedProjectGids(allowed);
          setForm((prev) => ({
            ...prev,
            projectGids: joinCsv(allowed),
            requestProjectGid:
              prev.requestProjectGid && allowed.includes(prev.requestProjectGid)
                ? prev.requestProjectGid
                : payload?.configured?.requestProjectGid && allowed.includes(payload.configured.requestProjectGid)
                  ? payload.configured.requestProjectGid
                  : allowed[0] ?? "",
          }));
        }
      } catch (error) {
        setAsanaError(error instanceof Error ? error.message : "Asana verisi alınamadı");
      } finally {
        setAsanaLoading(false);
      }
    },
    [authHeaders, form.projectGids],
  );

  const loadAsanaSections = useCallback(
    async (projectGid: string) => {
      if (!projectGid) {
        setSectionOptions([]);
        return;
      }
      setAsanaLoading(true);
      setAsanaError(null);
      try {
        const query = new URLSearchParams();
        if (form.workspaceGid) query.set("workspaceGid", form.workspaceGid);
        query.set("projectGid", projectGid);
        const response = await fetch(`/api/admin/asana/catalog?${query.toString()}`, {
          cache: "no-store",
          headers: (await authHeaders()) as HeadersInit,
        });
        const payload = (await response.json().catch(() => null)) as AsanaCatalogResponse | null;
        if (!response.ok) {
          throw new Error(payload?.error ?? "Section listesi alınamadı");
        }
        setSectionOptions(payload?.sections ?? []);
      } catch (error) {
        setAsanaError(error instanceof Error ? error.message : "Section verisi alınamadı");
      } finally {
        setAsanaLoading(false);
      }
    },
    [authHeaders, form.workspaceGid],
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
      void Promise.all([loadTenants(), loadAsanaCatalog()]).finally(() => {
        setAdminReady(true);
      });
    }, 0);
    return () => window.clearTimeout(kickoff);
  }, [enabled, user, isAdmin, adminReady, loadTenants, loadAsanaCatalog]);

  useEffect(() => {
    if (!(enabled && user && isAdmin)) return;
    if (!form.requestProjectGid) {
      const reset = window.setTimeout(() => {
        setSectionOptions([]);
      }, 0);
      return () => window.clearTimeout(reset);
    }
    const kickoff = window.setTimeout(() => {
      void loadAsanaSections(form.requestProjectGid);
    }, 0);
    return () => window.clearTimeout(kickoff);
  }, [enabled, user, isAdmin, form.requestProjectGid, loadAsanaSections]);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const response = await fetch("/api/admin/tenants", {
        method: "POST",
        headers: headers as HeadersInit,
        body: JSON.stringify(form),
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
        projectGids: prev.projectGids,
        requestProjectGid: prev.requestProjectGid,
        requestSectionGid: prev.requestSectionGid,
      }));
      await loadTenants();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Kaydetme başarısız");
    } finally {
      setSaving(false);
    }
  }

  async function onAdminLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseAuth) return;
    setAdminLoginError(null);
    setAdminLoggingIn(true);
    try {
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

  function onWorkspaceChange(nextWorkspaceGid: string) {
    setForm((prev) => ({
      ...prev,
      workspaceGid: nextWorkspaceGid,
      projectGids: "",
      requestProjectGid: "",
      requestSectionGid: "",
    }));
    setSelectedProjectGids([]);
    setSectionOptions([]);
    void loadAsanaCatalog(nextWorkspaceGid);
  }

  function onProjectSelectionChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextSelected = Array.from(event.target.selectedOptions, (option) => option.value);
    const normalized = [...new Set(nextSelected)];
    const nextRequestProject = normalized.includes(form.requestProjectGid)
      ? form.requestProjectGid
      : (normalized[0] ?? "");

    setSelectedProjectGids(normalized);
    setForm((prev) => ({
      ...prev,
      projectGids: joinCsv(normalized),
      requestProjectGid: nextRequestProject,
      requestSectionGid:
        nextRequestProject === prev.requestProjectGid ? prev.requestSectionGid : "",
    }));

    if (nextRequestProject) {
      void loadAsanaSections(nextRequestProject);
    } else {
      setSectionOptions([]);
    }
  }

  function onRequestProjectChange(nextProjectGid: string) {
    setForm((prev) => ({
      ...prev,
      requestProjectGid: nextProjectGid,
      requestSectionGid: "",
    }));
    if (nextProjectGid) {
      void loadAsanaSections(nextProjectGid);
    } else {
      setSectionOptions([]);
    }
  }

  const requestProjectOptions = useMemo(() => {
    const selected = projectOptions.filter((project) =>
      selectedProjectGids.includes(project.gid),
    );
    return selected.length > 0 ? selected : projectOptions;
  }, [projectOptions, selectedProjectGids]);

  if (!firebaseEnabled || !enabled) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-6 text-sm font-medium text-amber-800">
        Admin paneli için Firebase Auth zorunlu. Lütfen `.env.local` değerlerini
        tamamlayın.
      </section>
    );
  }

  if (adminChecking) {
    return (
      <section className="rounded-2xl border border-slate-200 bg-white px-6 py-6 text-sm text-slate-600">
        Admin yetkisi kontrol ediliyor...
      </section>
    );
  }

  if (!user || !isAdmin) {
    return (
      <div className="flex min-h-[78vh] items-center justify-center">
        <section className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin Girişi</h1>
          <p className="mt-2 text-sm text-slate-600">
            Devam etmek için yönetici bilgilerinizle giriş yapın.
          </p>

          {user && !isAdmin ? (
            <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
              Şu an farklı bir kullanıcı açık. Yönetici hesabı ile tekrar giriş yapın.
            </div>
          ) : null}

          <form className="mt-4 space-y-3" onSubmit={onAdminLogin}>
            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">E-posta</span>
              <span className="relative block">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
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
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-slate-700">Şifre</span>
              <span className="relative block">
                <LockKeyhole className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  required
                  type="password"
                  autoComplete="current-password"
                  value={adminPassword}
                  onChange={(event) => {
                    setAdminPassword(event.target.value);
                    setAdminLoginError(null);
                  }}
                  placeholder="Şifre"
                  className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-9 pr-3 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                />
              </span>
            </label>

            {adminLoginError ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {adminLoginError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={adminLoggingIn}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {adminLoggingIn ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Giriş Yap
            </button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Tenant Admin</h1>
            <p className="mt-1.5 text-sm text-slate-600">
              Marka onboarding, kullanıcı yetkisi ve Asana proje eşleşmelerini yönet.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => router.push("/")}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-100"
            >
              <ArrowLeft className="h-4 w-4" />
              Luma&apos;ya dön
            </button>
            <button
              type="button"
              onClick={() => void onSecureSignOut()}
              disabled={adminSigningOut}
              className="inline-flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {adminSigningOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LogOut className="h-4 w-4" />
              )}
              Güvenli çıkış
            </button>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-base font-bold text-slate-900">Yeni Marka Tanımla</h2>
          <form className="space-y-3" onSubmit={onSubmit}>
            <div className="space-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-800">Asana Seçimi</p>
                <button
                  type="button"
                  onClick={() => void loadAsanaCatalog(form.workspaceGid || undefined)}
                  disabled={asanaLoading}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {asanaLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCcw className="h-3.5 w-3.5" />
                  )}
                  Yenile
                </button>
              </div>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">Workspace</span>
                <select
                  value={form.workspaceGid}
                  onChange={(event) => onWorkspaceChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">Workspace seç</option>
                  {workspaceOptions.map((workspace) => (
                    <option key={workspace.gid} value={workspace.gid}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">
                  Projeler (çoklu seçim)
                </span>
                <select
                  multiple
                  value={selectedProjectGids}
                  onChange={onProjectSelectionChange}
                  className="h-36 w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                >
                  {projectOptions.map((project) => (
                    <option key={project.gid} value={project.gid}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-slate-500">
                  Mac&apos;te cmd, Windows&apos;ta ctrl ile çoklu seçim yapabilirsiniz.
                </p>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">
                  Talep Projesi
                </span>
                <select
                  value={form.requestProjectGid}
                  onChange={(event) => onRequestProjectChange(event.target.value)}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400"
                >
                  <option value="">Talep projesi seç</option>
                  {requestProjectOptions.map((project) => (
                    <option key={project.gid} value={project.gid}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-700">
                  Talep Section
                </span>
                <select
                  value={form.requestSectionGid}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, requestSectionGid: event.target.value }))
                  }
                  disabled={!form.requestProjectGid}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:ring-2 focus:ring-slate-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="">Section seç</option>
                  {sectionOptions.map((section) => (
                    <option key={section.gid} value={section.gid}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </label>

              {asanaError ? (
                <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">
                  {asanaError}
                </p>
              ) : null}
            </div>

            <input
              value={form.brandName}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, brandName: event.target.value }))
              }
              placeholder="Marka adı"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            />
            <input
              value={form.brandCode}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, brandCode: event.target.value.toUpperCase() }))
              }
              placeholder="Marka kodu (örn ALT101)"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            />
            <input
              type="email"
              value={form.email}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, email: event.target.value }))
              }
              placeholder="Yetkili e-posta"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            />
            <input
              type="text"
              value={form.password}
              onChange={(event) =>
                setForm((prev) => ({ ...prev, password: event.target.value }))
              }
              placeholder="Şifre (boşsa otomatik üretilir)"
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm outline-none focus:ring-2 focus:ring-slate-400"
            />
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
              Asana proje ve section eşleşmeleri yukarıdaki seçim alanlarından otomatik
              uygulanır.
            </p>
            <button
              type="submit"
              disabled={saving || !canSubmit}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Tenant ve kullanıcı kaydet
            </button>
            {error ? (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                {success}
              </p>
            ) : null}
          </form>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-900">Kayıtlı Markalar</h2>
            <button
              type="button"
              onClick={() => void loadTenants()}
              className="text-sm font-semibold text-slate-700"
            >
              Yenile
            </button>
          </div>
          {loading ? (
            <p className="text-sm text-slate-600">Yükleniyor...</p>
          ) : tenants.length === 0 ? (
            <p className="text-sm text-slate-600">Henüz tenant kaydı yok.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Marka</th>
                    <th className="px-3 py-2 font-semibold">Kod</th>
                    <th className="px-3 py-2 font-semibold">Kullanıcı</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((tenant) => (
                    <tr key={tenant.tenantId} className="border-t border-slate-200">
                      <td className="px-3 py-2 text-slate-900">{tenant.brandName}</td>
                      <td className="px-3 py-2 text-slate-700">{tenant.asana.brandCode}</td>
                      <td className="px-3 py-2 text-slate-700">{tenant.emails.join(", ")}</td>
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
