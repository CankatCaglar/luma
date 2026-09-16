"use client";

import { Fragment, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  browserLocalPersistence,
  browserSessionPersistence,
  setPersistence,
  signInWithEmailAndPassword,
} from "firebase/auth";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Bell,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  Eye,
  EyeOff,
  FolderOpen,
  Info,
  LayoutGrid,
  Loader2,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Pencil,
  Plus,
  RefreshCcw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { LumaLogo, LumaStar } from "@/components/layout/NeraLogo";
import {
  isValidPortalUsername,
  portalEmailFromUsername,
} from "@/lib/auth/portalLogin";
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
  portalUsername?: string;
  portalPassword?: string;
  asana: {
    brandCode: string;
    projectGids: string[];
    requestProjectGid?: string;
    requestSectionGid?: string;
  };
  drive?: {
    rootUrl?: string;
  };
  reportsEnabled?: boolean;
};

type AdminSection = "onboarding" | "mail" | "notifications";

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
  username: string;
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
  username: "",
  contactEmail: "",
  password: "",
  workspaceGid: "",
  ...EMPTY_DRIVE,
};

const SIDEBAR_COLLAPSED_KEY = "luma-admin-sidebar-collapsed";
const BRAND_TABLE_HEAD_HEIGHT = 36;
const BRAND_ROW_MIN_HEIGHT = 52;
const BRAND_TABLE_SCROLL_GUTTER = 12;

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
  const [adminMenuOpen, setAdminMenuOpen] = useState(false);
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [adminReady, setAdminReady] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [tenantToDelete, setTenantToDelete] = useState<Tenant | null>(null);
  const [brandQuery, setBrandQuery] = useState("");
  const [brandPage, setBrandPage] = useState(1);
  const [brandsPerPage, setBrandsPerPage] = useState(8);
  const [brandRowHeight, setBrandRowHeight] = useState(BRAND_ROW_MIN_HEIGHT);
  const brandTableViewportRef = useRef<HTMLDivElement>(null);
  const [adminSection, setAdminSection] = useState<AdminSection>("onboarding");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingKind, setEditingKind] = useState<"drive" | "account" | null>(null);
  const [togglingReportsId, setTogglingReportsId] = useState<string | null>(null);
  const [driveDraft, setDriveDraft] = useState<DriveForm>(EMPTY_DRIVE);
  const [contactDraft, setContactDraft] = useState("");
  const [passwordDraft, setPasswordDraft] = useState("");
  const [showPasswordDraft, setShowPasswordDraft] = useState(false);
  const [revealedPasswordIds, setRevealedPasswordIds] = useState<string[]>([]);
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
      isValidPortalUsername(form.username) &&
      (!form.contactEmail.trim() || form.contactEmail.includes("@")) &&
      Boolean(form.workspaceGid) &&
      (lookup?.projectGids.length ?? 0) > 0 &&
      lookup?.brandCode === form.brandCode.trim().toUpperCase(),
    [form, lookup],
  );

  const filteredTenants = useMemo(() => {
    const query = brandQuery.trim().toLowerCase();
    if (!query) return tenants;
    return tenants.filter((tenant) => {
      const username = tenant.portalUsername || tenant.emails[0]?.split("@")[0] || "";
      return [
        tenant.brandName,
        tenant.asana.brandCode,
        username,
        tenant.emails.join(" "),
        tenant.contactEmail ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [brandQuery, tenants]);

  const brandPageCount = Math.max(1, Math.ceil(filteredTenants.length / brandsPerPage));
  const currentBrandPage = Math.min(brandPage, brandPageCount);
  const pagedTenants = useMemo(() => {
    const start = (currentBrandPage - 1) * brandsPerPage;
    return filteredTenants.slice(start, start + brandsPerPage);
  }, [brandsPerPage, currentBrandPage, filteredTenants]);

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
    try {
      setSidebarCollapsed(window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      /* private mode */
    }
  }, []);

  useLayoutEffect(() => {
    const viewport = brandTableViewportRef.current;
    if (!viewport) return;
    const desktop = window.matchMedia("(min-width: 1280px)");
    const sync = () => {
      if (!desktop.matches) {
        setBrandsPerPage(10);
        setBrandRowHeight(BRAND_ROW_MIN_HEIGHT);
        return;
      }
      const headHeight =
        viewport.querySelector("thead")?.getBoundingClientRect().height ||
        BRAND_TABLE_HEAD_HEIGHT;
      const padBottom = Number.parseFloat(getComputedStyle(viewport).paddingBottom) || 0;
      const available = Math.max(
        BRAND_ROW_MIN_HEIGHT,
        viewport.clientHeight - headHeight - padBottom - 1,
      );
      const perPage = Math.max(1, Math.floor(available / BRAND_ROW_MIN_HEIGHT));
      setBrandsPerPage(perPage);
      setBrandRowHeight(Math.floor(available / perPage));
    };
    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(viewport);
    desktop.addEventListener("change", sync);
    return () => {
      observer.disconnect();
      desktop.removeEventListener("change", sync);
    };
  }, [adminReady, adminSection]);

  useEffect(() => {
    setBrandPage(1);
  }, [brandQuery]);

  useEffect(() => {
    setBrandPage((page) => Math.min(page, brandPageCount));
  }, [brandPageCount]);

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
    const username = form.username.trim().toLowerCase();
    const brandCode = form.brandCode.trim().toUpperCase();
    if (
      tenants.some((tenant) => {
        const existing = (tenant.portalUsername ?? tenant.emails[0]?.split("@")[0] ?? "")
          .toLowerCase();
        return existing === username;
      })
    ) {
      setError("Bu kullanıcı adı zaten kayıtlı bir markaya ait.");
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
          username: form.username,
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
        `${payload?.tenant?.brandName ?? "Marka"} kaydedildi. Kullanıcı ${created}: ${username}${payload?.user?.email ? ` · Firebase: ${payload.user.email}` : ""}${driveNote ? ` · ${driveNote}` : ""}`,
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

  function closeEditor() {
    setEditingId(null);
    setEditingKind(null);
  }

  function onEditAccount(tenant: Tenant) {
    if (editingId === tenant.tenantId && editingKind === "account") {
      closeEditor();
      return;
    }
    setEditingId(tenant.tenantId);
    setEditingKind("account");
    setContactDraft(tenant.contactEmail ?? "");
    setPasswordDraft("");
    setShowPasswordDraft(false);
    setError(null);
    setSuccess(null);
  }

  async function onToggleReports(tenant: Tenant, reportsEnabled: boolean) {
    setTogglingReportsId(tenant.tenantId);
    setError(null);
    setSuccess(null);
    setTenants((prev) =>
      prev.map((item) =>
        item.tenantId === tenant.tenantId ? { ...item, reportsEnabled } : item,
      ),
    );
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const response = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: headers as HeadersInit,
        body: JSON.stringify({
          tenantId: tenant.tenantId,
          reportsEnabled,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        tenant?: Tenant;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Rapor erişimi kaydedilemedi");
      }
      if (payload?.tenant) {
        setTenants((prev) =>
          prev.map((item) => (item.tenantId === tenant.tenantId ? payload.tenant! : item)),
        );
      }
    } catch (error) {
      setTenants((prev) =>
        prev.map((item) =>
          item.tenantId === tenant.tenantId
            ? { ...item, reportsEnabled: tenant.reportsEnabled === true }
            : item,
        ),
      );
      setError(error instanceof Error ? error.message : "Rapor erişimi kaydedilemedi");
    } finally {
      setTogglingReportsId(null);
    }
  }

  function togglePasswordReveal(tenantId: string) {
    setRevealedPasswordIds((prev) =>
      prev.includes(tenantId) ? prev.filter((id) => id !== tenantId) : [...prev, tenantId],
    );
  }

  async function copyPortalPassword(password: string) {
    try {
      await navigator.clipboard.writeText(password);
      setSuccess("Şifre kopyalandı");
      setError(null);
    } catch {
      setError("Şifre kopyalanamadı");
    }
  }

  async function onSaveAccount(tenant: Tenant) {
    if (contactDraft.trim() && !contactDraft.includes("@")) {
      setError("Geçerli bir iletişim e-postası girin.");
      return;
    }
    const password = passwordDraft.trim();
    if (password && password.length < 8) {
      setError("Şifre en az 8 karakter olmalı.");
      return;
    }
    setSavingDriveId(tenant.tenantId);
    setError(null);
    setSuccess(null);
    try {
      const headers = await authHeaders();
      headers["Content-Type"] = "application/json";
      const contactResponse = await fetch("/api/admin/tenants", {
        method: "PATCH",
        headers: headers as HeadersInit,
        body: JSON.stringify({
          tenantId: tenant.tenantId,
          contactEmail: contactDraft,
        }),
      });
      const contactPayload = (await contactResponse.json().catch(() => null)) as {
        error?: string;
        tenant?: Tenant;
      } | null;
      if (!contactResponse.ok) {
        throw new Error(contactPayload?.error ?? "İletişim e-postası kaydedilemedi");
      }
      let nextTenant = contactPayload?.tenant;
      if (password) {
        const passwordResponse = await fetch("/api/admin/tenants", {
          method: "PATCH",
          headers: headers as HeadersInit,
          body: JSON.stringify({
            tenantId: tenant.tenantId,
            password,
          }),
        });
        const passwordPayload = (await passwordResponse.json().catch(() => null)) as {
          error?: string;
          tenant?: Tenant;
        } | null;
        if (!passwordResponse.ok) {
          throw new Error(passwordPayload?.error ?? "Şifre kaydedilemedi");
        }
        nextTenant = passwordPayload?.tenant ?? nextTenant;
      }
      if (nextTenant) {
        setTenants((prev) =>
          prev.map((item) => (item.tenantId === tenant.tenantId ? nextTenant! : item)),
        );
      }
      setSuccess(
        password
          ? `${tenant.brandName} iletişim ve şifre güncellendi`
          : `${tenant.brandName} iletişim e-postası kaydedildi`,
      );
      closeEditor();
      await loadTenants();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Marka bilgisi kaydedilemedi");
    } finally {
      setSavingDriveId(null);
    }
  }

  function onEditDrive(tenant: Tenant) {
    if (editingId === tenant.tenantId && editingKind === "drive") {
      closeEditor();
      return;
    }
    setEditingId(tenant.tenantId);
    setEditingKind("drive");
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
      closeEditor();
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

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((current) => {
      const next = !current;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0");
      } catch {
        /* private mode */
      }
      return next;
    });
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

  const sectionTitle =
    adminSection === "mail"
      ? "Mail Ayarları"
      : adminSection === "notifications"
        ? "Bildirim Ayarları"
        : "Marka Onboarding";
  const sectionDescription =
    adminSection === "mail"
      ? "Markalara gidecek otomatik maillerin şablonlarını buradan yöneteceksiniz."
      : adminSection === "notifications"
        ? "Portal bildirimlerinin hangi olaylarda gideceğini buradan yöneteceksiniz."
        : "Marka kodunu yaz, Asana workspace'inden eşleşmeyi otomatik bul.";

  return (
    <div className="flex h-dvh w-full min-w-0 overflow-hidden bg-[#FBF9F5]">
        {sidebarOpen ? (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-[#1c1917]/30 lg:hidden"
            aria-label="Menüyü kapat"
            onClick={() => setSidebarOpen(false)}
          />
        ) : null}
        <aside
          className={`flex h-full shrink-0 flex-col overflow-visible border-r border-luma-border bg-white transition-[width,transform] duration-200 ease-out ${
            sidebarOpen ? "fixed inset-y-0 left-0 z-50 w-64 translate-x-0" : "fixed inset-y-0 left-0 z-50 w-64 -translate-x-full"
          } lg:static lg:z-0 lg:translate-x-0 ${
            sidebarCollapsed ? "lg:w-[4.75rem]" : "lg:w-64"
          }`}
        >
          <div
            className={`flex h-16 shrink-0 items-center border-b border-luma-border ${
              sidebarCollapsed ? "justify-between px-4 lg:justify-center lg:px-2" : "justify-between px-4"
            }`}
          >
            <div className={`flex min-w-0 items-center ${sidebarCollapsed ? "lg:hidden" : ""}`}>
              <LumaLogo height={32} />
            </div>
            <button
              type="button"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-luma-muted lg:hidden"
              onClick={() => setSidebarOpen(false)}
              aria-label="Menüyü kapat"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              className="hidden h-9 w-9 items-center justify-center rounded-xl text-luma-muted transition-colors hover:bg-luma-soft hover:text-luma lg:inline-flex"
              onClick={toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? "Menüyü genişlet" : "Menüyü daralt"}
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="h-4 w-4" />
              ) : (
                <PanelLeftClose className="h-4 w-4" />
              )}
            </button>
          </div>
          <nav
            className={`flex flex-1 flex-col gap-1 overflow-y-auto py-3 ${
              sidebarCollapsed ? "lg:items-center lg:px-2" : "px-3"
            }`}
          >
            <AdminNavButton
              active={adminSection === "onboarding"}
              collapsed={sidebarCollapsed}
              icon={<LayoutGrid className="h-4 w-4" />}
              label="Marka Onboarding"
              onClick={() => {
                setAdminSection("onboarding");
                setSidebarOpen(false);
              }}
            />
            <AdminNavButton
              active={adminSection === "mail"}
              collapsed={sidebarCollapsed}
              icon={<Mail className="h-4 w-4" />}
              label="Mail Ayarları"
              onClick={() => {
                setAdminSection("mail");
                setSidebarOpen(false);
              }}
            />
            <AdminNavButton
              active={adminSection === "notifications"}
              collapsed={sidebarCollapsed}
              icon={<Bell className="h-4 w-4" />}
              label="Bildirim Ayarları"
              onClick={() => {
                setAdminSection("notifications");
                setSidebarOpen(false);
              }}
            />
          </nav>
          <div className={`px-3 pb-3 ${sidebarCollapsed ? "lg:px-2" : ""}`}>
            <SidebarDriveShare email={driveStatus?.email} collapsed={sidebarCollapsed} />
          </div>
          <div className={`border-t border-luma-border py-3 ${sidebarCollapsed ? "lg:px-2" : "px-3"}`}>
            <button
              type="button"
              onClick={() => void onLeaveToLuma()}
              disabled={adminSigningOut}
              title="Luma'ya dön"
              className={`inline-flex items-center rounded-xl text-sm font-semibold text-luma-muted transition-colors hover:bg-luma-soft hover:text-foreground disabled:opacity-70 ${
                sidebarCollapsed
                  ? "h-11 w-full justify-center gap-0 lg:h-11 lg:w-11 lg:px-0"
                  : "w-full gap-2 px-3 py-2.5"
              }`}
            >
              {adminSigningOut ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowLeft className="h-4 w-4" />
              )}
              <span className={sidebarCollapsed ? "lg:hidden" : ""}>Luma&apos;ya dön</span>
            </button>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-luma-border bg-[#FBF9F5] px-4 py-3 sm:px-6">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-luma-border bg-white text-foreground lg:hidden"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Menüyü aç"
                >
                  <Menu className="h-4 w-4" />
                </button>
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                  {sectionTitle}
                </h1>
              </div>
              <p className="mt-1 max-w-xl text-sm leading-relaxed text-luma-muted">
                {sectionDescription}
              </p>
            </div>
            <AdminAccountMenu
              email={user?.email}
              open={adminMenuOpen}
              busy={adminSigningOut}
              onOpenChange={setAdminMenuOpen}
              onSignOut={() => {
                setAdminMenuOpen(false);
                setSignOutConfirmOpen(true);
              }}
            />
          </header>

          <div className="min-h-0 min-w-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
      {adminSection === "onboarding" ? (
        <>
      <div className="grid min-w-0 items-stretch gap-4 sm:gap-6 xl:grid-cols-[minmax(20rem,22rem)_minmax(0,1fr)]">
        <section className="min-w-0 rounded-3xl bg-white p-4 shadow-[0_16px_48px_rgba(28,25,23,0.08)] ring-1 ring-luma-border/80 sm:p-5">
          <h2 className="mb-4 flex items-center gap-1.5 text-base font-bold text-foreground">
            Yeni Marka Tanımla
            <FieldHint text="Proje veya section seçmene gerek yok. Marka kodu seçili workspace içinde aranır." />
          </h2>
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

            <div className="block">
              <div className="mb-1 flex items-center gap-1.5">
                <label className="text-sm font-medium text-foreground">Marka kodu</label>
                <FieldHint text="Marka kodunu yaz, ilgili işler ve eşleşme otomatik gelsin." />
              </div>
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
            </div>

            <LookupPreview
              brandCode={form.brandCode}
              loading={lookupLoading}
              error={lookupError}
              lookup={lookup}
            />

            <label className="block">
              <span className="mb-1 block text-sm font-medium text-foreground">Marka adı</span>
              <input
                value={form.brandName}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, brandName: event.target.value }))
                }
                placeholder="Marka adı"
                className={fieldClassName}
              />
            </label>
            <div className="block">
              <div className="mb-1 flex items-center gap-1.5">
                <label className="text-sm font-medium text-foreground">Kullanıcı adı (giriş)</label>
                <FieldHint text="Müşteriye bu kullanıcı adı ve şifreyi verirsiniz. Arkada Firebase için otomatik bir e-posta üretilir." />
              </div>
              <input
                type="text"
                autoComplete="off"
                value={form.username}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, username: event.target.value }))
                }
                placeholder="Kullanıcı adı"
                className={fieldClassName}
              />
              {isValidPortalUsername(form.username) ? (
                <span className="mt-1 block text-xs leading-relaxed text-luma-muted">
                  Firebase giriş e-postası:{" "}
                  <span className="font-semibold text-foreground">
                    {portalEmailFromUsername(form.username)}
                  </span>
                </span>
              ) : null}
            </div>
            <div className="block">
              <div className="mb-1 flex items-center gap-1.5">
                <label className="text-sm font-medium text-foreground">İletişim e-postası</label>
                <FieldHint text="Zorunlu değil. Uygulamadan gönderilecek mailler bu adrese gider; sonradan da eklenebilir." />
              </div>
              <input
                type="email"
                value={form.contactEmail}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, contactEmail: event.target.value }))
                }
                placeholder="İletişim e-postası (opsiyonel)"
                className={fieldClassName}
              />
            </div>
            <div className="block">
              <div className="mb-1 flex items-center gap-1.5">
                <label className="text-sm font-medium text-foreground">Şifre</label>
                <FieldHint text="Boş bırakılırsa otomatik üretilir." />
              </div>
              <input
                type="text"
                value={form.password}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, password: event.target.value }))
                }
                placeholder="Şifre"
                className={fieldClassName}
              />
            </div>
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

        <section className="flex min-h-0 min-w-0 flex-col rounded-3xl bg-white p-4 shadow-[0_16px_48px_rgba(28,25,23,0.08)] ring-1 ring-luma-border/80 sm:p-5 xl:h-0 xl:min-h-full xl:overflow-hidden">
          <div className="mb-3 flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-base font-bold text-foreground">Kayıtlı Markalar</h2>
            <div className="flex min-w-0 items-center gap-2">
              <span className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-luma-muted" />
                <input
                  value={brandQuery}
                  onChange={(event) => setBrandQuery(event.target.value)}
                  placeholder="Marka ara..."
                  className="w-full rounded-xl border border-luma-border bg-white py-2 pl-9 pr-3 text-sm text-foreground outline-none placeholder:text-luma-muted focus:ring-2 focus:ring-luma"
                />
              </span>
              <button
                type="button"
                onClick={() => void loadTenants()}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-luma-border px-3 py-2 text-sm font-semibold text-foreground hover:bg-luma-soft"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                Yenile
              </button>
            </div>
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
          <div
            ref={brandTableViewportRef}
            style={{ paddingBottom: BRAND_TABLE_SCROLL_GUTTER }}
            className={`min-h-0 overflow-x-auto rounded-2xl ring-1 ring-luma-border/80 xl:flex-1 ${
              editingKind ? "overflow-y-auto" : "overflow-y-visible xl:overflow-y-hidden"
            }`}
          >
            {loading || tenants.length === 0 || filteredTenants.length === 0 ? (
              <div className="flex h-full items-center justify-center px-4 text-sm text-luma-muted">
                {loading
                  ? "Yükleniyor..."
                  : tenants.length === 0
                    ? "Henüz tenant kaydı yok."
                    : "Aramanızla eşleşen marka yok."}
              </div>
            ) : (
              <table className="w-full min-w-[68rem] text-left text-sm">
                <thead className="sticky top-0 bg-luma-soft text-luma-kahve">
                  <tr>
                    <th className="px-3 py-2 font-semibold">Marka</th>
                    <th className="px-3 py-2 text-center font-semibold">Kod</th>
                    <th className="px-3 py-2 text-center font-semibold">Kullanıcı adı</th>
                    <th className="px-3 py-2 text-center font-semibold">Firebase e-posta</th>
                    <th className="px-3 py-2 text-center font-semibold">Rapor erişimi</th>
                    <th className="px-3 py-2 text-center font-semibold">Şifre</th>
                    <th className="px-3 py-2 text-center font-semibold">İletişim</th>
                    <th className="px-2 py-2 text-right font-semibold">İşlemler</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTenants.map((tenant) => (
                    <Fragment key={tenant.tenantId}>
                      <tr
                        className="box-border border-t border-luma-border"
                        style={{ height: brandRowHeight }}
                      >
                        <td className="px-3 py-1 align-middle text-foreground">
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
                        <td className="px-3 py-1 align-middle text-center font-semibold text-luma">
                          {tenant.asana.brandCode}
                        </td>
                        <td className="min-w-0 px-3 py-1 align-middle text-center font-medium break-all text-foreground">
                          {tenant.portalUsername || tenant.emails[0]?.split("@")[0] || "—"}
                        </td>
                        <td className="min-w-0 px-3 py-1 align-middle text-center break-all text-luma-muted">
                          {tenant.emails.join(", ")}
                        </td>
                        <td className="px-3 py-1 align-middle text-center">
                          <div className="flex justify-center">
                            <ReportSwitch
                              checked={tenant.reportsEnabled === true}
                              disabled={togglingReportsId === tenant.tenantId}
                              label={`${tenant.brandName} rapor erişimi`}
                              onChange={(checked) => void onToggleReports(tenant, checked)}
                            />
                          </div>
                        </td>
                        <td className="min-w-0 px-3 py-1 align-middle text-center text-luma-muted">
                          {tenant.portalPassword ? (
                            <div className="inline-flex items-center justify-center gap-1">
                              <span className="max-w-36 truncate font-medium text-foreground">
                                {revealedPasswordIds.includes(tenant.tenantId)
                                  ? tenant.portalPassword
                                  : "••••••••"}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePasswordReveal(tenant.tenantId)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-luma-muted hover:bg-luma-soft hover:text-luma"
                                aria-label={
                                  revealedPasswordIds.includes(tenant.tenantId)
                                    ? `${tenant.brandName} şifresini gizle`
                                    : `${tenant.brandName} şifresini göster`
                                }
                              >
                                {revealedPasswordIds.includes(tenant.tenantId) ? (
                                  <EyeOff className="h-3.5 w-3.5" />
                                ) : (
                                  <Eye className="h-3.5 w-3.5" />
                                )}
                              </button>
                              <button
                                type="button"
                                onClick={() => void copyPortalPassword(tenant.portalPassword!)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-luma-muted hover:bg-luma-soft hover:text-luma"
                                aria-label={`${tenant.brandName} şifresini kopyala`}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ) : (
                            <span>Kayıtlı değil</span>
                          )}
                        </td>
                        <td className="min-w-0 px-3 py-1 align-middle text-center break-all text-luma-muted">
                          {tenant.contactEmail || "—"}
                        </td>
                        <td className="px-2 py-1 align-middle text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onEditAccount(tenant)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-luma-muted transition-colors hover:bg-luma-soft hover:text-luma"
                              aria-label={`${tenant.brandName} bilgilerini düzenle`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
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
                      {editingId === tenant.tenantId && editingKind === "account" ? (
                        <tr className="border-t border-luma-border bg-luma-soft/60">
                          <td colSpan={8} className="px-3 py-3">
                            <p className="mb-2 text-xs font-semibold text-luma-kahve">
                              {tenant.brandName} iletişim ve şifre
                            </p>
                            <div className="grid gap-3 md:grid-cols-2">
                              <label className="block">
                                <span className="mb-1 block text-sm font-medium text-foreground">
                                  İletişim e-postası
                                </span>
                                <input
                                  type="email"
                                  value={contactDraft}
                                  onChange={(event) => setContactDraft(event.target.value)}
                                  placeholder="İletişim e-postası (opsiyonel)"
                                  className={fieldClassName}
                                />
                              </label>
                              <label className="block">
                                <span className="mb-1 block text-sm font-medium text-foreground">
                                  Yeni şifre
                                </span>
                                <span className="relative block">
                                  <input
                                    type={showPasswordDraft ? "text" : "password"}
                                    value={passwordDraft}
                                    onChange={(event) => setPasswordDraft(event.target.value)}
                                    placeholder="Boş bırakırsanız şifre değişmez"
                                    className={`${fieldClassName} pr-11`}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => setShowPasswordDraft((prev) => !prev)}
                                    className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-luma-muted hover:text-luma"
                                    aria-label={showPasswordDraft ? "Şifreyi gizle" : "Şifreyi göster"}
                                  >
                                    {showPasswordDraft ? (
                                      <EyeOff className="h-4 w-4" />
                                    ) : (
                                      <Eye className="h-4 w-4" />
                                    )}
                                  </button>
                                </span>
                              </label>
                            </div>
                            <div className="mt-3 flex flex-wrap gap-2">
                              <button
                                type="button"
                                onClick={() => void onSaveAccount(tenant)}
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
                                onClick={closeEditor}
                                className="rounded-xl px-4 py-2 text-sm font-semibold text-luma-muted"
                              >
                                Vazgeç
                              </button>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                      {editingId === tenant.tenantId && editingKind === "drive" ? (
                        <tr className="border-t border-luma-border bg-luma-soft/60">
                          <td colSpan={8} className="px-3 py-3">
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
                                onClick={closeEditor}
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
            )}
          </div>
          <AdminPagination
            page={currentBrandPage}
            pageCount={brandPageCount}
            total={filteredTenants.length}
            pageSize={brandsPerPage}
            onPageChange={setBrandPage}
          />
        </section>
      </div>
        </>
      ) : (
        <AdminComingSoon
          title={sectionTitle}
          description={
            adminSection === "mail"
              ? "Mail şablonları ve gönderim kuralları bu ekranda toplanacak. Şimdilik marka onboarding üzerinden devam edin."
              : "Bildirim kanalları ve tetikleyiciler bu ekranda toplanacak. Şimdilik marka onboarding üzerinden devam edin."
          }
        />
      )}
          </div>
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

function AdminAccountMenu({
  email,
  open,
  busy,
  onOpenChange,
  onSignOut,
}: {
  email?: string | null;
  open: boolean;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
}) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [menuBox, setMenuBox] = useState<{ top: number; left: number; width: number } | null>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onOpenChange(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onOpenChange]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuBox(null);
      return;
    }

    const place = () => {
      const button = buttonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const width = Math.min(224, window.innerWidth - 16);
      const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8));
      setMenuBox({ top: rect.bottom + 8, left, width });
    };

    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  return (
    <div className="relative ml-auto shrink-0">
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => onOpenChange(!open)}
        className="inline-flex items-center gap-2 rounded-full py-1 pl-1 pr-2.5 transition-colors hover:bg-white"
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-luma text-xs font-bold text-white">
          TA
        </span>
        <span className="hidden text-sm font-semibold text-foreground sm:inline">Tenant Admin</span>
        <ChevronDown
          className={`h-4 w-4 text-luma-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label="Menüyü kapat"
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => onOpenChange(false)}
          />
          {menuBox
            ? createPortal(
                <div
                  role="menu"
                  style={{ top: menuBox.top, left: menuBox.left, width: menuBox.width }}
                  className="fixed z-50 overflow-hidden rounded-2xl bg-white py-1.5 shadow-[0_12px_40px_rgba(28,25,23,0.12)] ring-1 ring-luma-border"
                >
                  {email ? (
                    <p className="truncate px-3.5 pb-1.5 pt-1 text-xs text-luma-muted">{email}</p>
                  ) : null}
                  <button
                    type="button"
                    role="menuitem"
                    disabled={busy}
                    onClick={onSignOut}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-semibold text-luma-red transition-colors hover:bg-red-50 disabled:opacity-60"
                  >
                    {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    Güvenli çıkış
                  </button>
                </div>,
                document.body
              )
            : null}
        </>
      ) : null}
    </div>
  );
}

function AdminNavButton({
  active,
  collapsed,
  icon,
  label,
  onClick,
}: {
  active: boolean;
  collapsed: boolean;
  icon: ReactNode;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      onClick={onClick}
      className={`inline-flex items-center rounded-xl text-sm font-semibold transition-colors ${
        collapsed
          ? "w-full gap-2.5 px-3 py-2.5 lg:h-11 lg:w-11 lg:justify-center lg:gap-0 lg:px-0"
          : "w-full gap-2.5 px-3 py-2.5"
      } ${
        active ? "bg-luma-soft text-luma" : "text-luma-muted hover:bg-[#FBF9F5] hover:text-foreground"
      }`}
    >
      {icon}
      <span className={collapsed ? "lg:hidden" : ""}>{label}</span>
    </button>
  );
}

function paginationItems(page: number, pageCount: number): Array<number | "…"> {
  if (pageCount <= 7) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  const items: Array<number | "…"> = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) items.push("…");
  for (let value = start; value <= end; value += 1) items.push(value);
  if (end < pageCount - 1) items.push("…");
  items.push(pageCount);
  return items;
}

function AdminPagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
}: {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);
  const items = paginationItems(page, Math.max(pageCount, 1));

  return (
    <div className="mt-3 flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-luma-border/80 pt-3">
      <p className="text-xs font-medium text-luma-muted">
        {from}–{to} / {total} marka
      </p>
      <div className="flex items-center gap-1">
        <button
          type="button"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-luma-muted transition-colors hover:bg-luma-soft hover:text-luma disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Önceki sayfa"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {items.map((item, index) =>
          item === "…" ? (
            <span key={`ellipsis-${index}`} className="px-1 text-sm text-luma-muted">
              …
            </span>
          ) : (
            <button
              key={item}
              type="button"
              onClick={() => onPageChange(item)}
              aria-current={item === page ? "page" : undefined}
              className={`inline-flex h-8 min-w-8 items-center justify-center rounded-lg px-2 text-sm font-semibold transition-colors ${
                item === page
                  ? "bg-luma text-white"
                  : "text-luma-muted hover:bg-luma-soft hover:text-luma"
              }`}
            >
              {item}
            </button>
          ),
        )}
        <button
          type="button"
          disabled={page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-luma-muted transition-colors hover:bg-luma-soft hover:text-luma disabled:cursor-not-allowed disabled:opacity-40"
          aria-label="Sonraki sayfa"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function ReportSwitch({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "bg-luma" : "bg-[#d7d0c8]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-[left] ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function AdminComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <section className="rounded-3xl bg-white p-6 shadow-[0_16px_48px_rgba(28,25,23,0.08)] ring-1 ring-luma-border/80 sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-wide text-luma">Yakında</p>
      <h2 className="mt-2 text-xl font-bold text-foreground">{title}</h2>
      <p className="mt-2 max-w-xl text-sm leading-relaxed text-luma-muted">{description}</p>
    </section>
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

  if (code.length < 3) return null;

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
      <p className="flex items-center gap-1.5 pt-1 text-xs font-semibold uppercase tracking-wide text-luma-kahve">
        Drive
        <FieldHint text="Kutuyu Firebase Admin e-postasına Viewer paylaş, linki buraya yapıştır. Logo, brief, rakip analizi ve aylık planlar klasörden otomatik gelir." />
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

function FieldHint({ text, size = "sm" }: { text: string; size?: "sm" | "md" }) {
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null);

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    const tooltip = tooltipRef.current;
    if (!button || !tooltip) return;

    const rect = button.getBoundingClientRect();
    const width = Math.min(240, window.innerWidth - 16);
    const gap = 8;
    const height = tooltip.offsetHeight;
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const showAbove =
      rect.bottom + gap + height > window.innerHeight - 8 && rect.top - gap - height >= 8;
    const next = {
      width,
      left,
      top: showAbove ? rect.top - height - gap : rect.bottom + gap,
    };
    setCoords((prev) =>
      prev && prev.top === next.top && prev.left === next.left && prev.width === next.width
        ? prev
        : next
    );
  }, []);

  useLayoutEffect(() => {
    if (!open) {
      setCoords(null);
      return;
    }
    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [open, text, updatePosition]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        tabIndex={-1}
        onMouseDown={(event) => event.preventDefault()}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className={`inline-flex shrink-0 items-center justify-center rounded-full text-luma-muted/70 transition-colors hover:text-luma ${
          size === "md" ? "h-7 w-7" : "h-4 w-4"
        }`}
        aria-label="Bilgi"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
      {open
        ? createPortal(
            <span
              ref={tooltipRef}
              role="tooltip"
              style={
                coords
                  ? { top: coords.top, left: coords.left, width: coords.width }
                  : { visibility: "hidden", top: 0, left: 0 }
              }
              className="pointer-events-none fixed z-[80] w-60 rounded-xl bg-[#1c1917] px-3 py-2 text-left text-[11px] font-normal normal-case leading-relaxed tracking-normal text-white shadow-[0_12px_32px_rgba(28,25,23,0.24)]"
            >
              {text}
            </span>,
            document.body
          )
        : null}
    </>
  );
}

function SidebarDriveShare({
  email,
  collapsed,
}: {
  email?: string;
  collapsed: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const value = email?.trim() ?? "";
  if (!value) return null;

  async function copyEmail() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  const hint =
    "Bu adresi markanın Drive kutusuna Viewer ekle, sonra sağdaki klasör ikonuna kutu linkini kaydet.";

  return (
    <div className={`min-w-0 ${collapsed ? "lg:flex lg:justify-center" : ""}`}>
      <p
        className={`mb-1.5 text-[11px] font-semibold text-luma-kahve ${
          collapsed ? "lg:hidden" : ""
        }`}
      >
        Drive paylaşım
      </p>
      <div
        className={`flex min-w-0 items-center gap-1 ${
          collapsed ? "lg:flex-col" : ""
        }`}
      >
        <p
          className={`min-w-0 flex-1 truncate font-mono text-[10px] leading-4 text-foreground ${
            collapsed ? "lg:hidden" : ""
          }`}
          title={value}
        >
          {value}
        </p>
        <button
          type="button"
          onClick={() => void copyEmail()}
          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-luma-muted transition-colors hover:bg-luma-soft hover:text-luma"
          aria-label={copied ? "E-posta kopyalandı" : "E-postayı kopyala"}
          title={copied ? "Kopyalandı" : "Kopyala"}
        >
          {copied ? <Check className="h-3.5 w-3.5 text-luma-green" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
        <FieldHint text={hint} size="md" />
      </div>
    </div>
  );
}
