"use client";

import { useEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header, HeaderCountProvider } from "@/components/layout/Header";
import { JobsProvider } from "@/components/jobs/JobsProvider";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import {
  readLastBrandSession,
  subscribeLastBrandSession,
} from "@/lib/session/lastBrandSession";
import { bindAppHaptics } from "@/lib/haptic";

function getServerLastBrandSession() {
  return null;
}

// Tarayıcı ilk açılışta önceki oturumun kaydırma konumunu geri yükleyebiliyor;
// içerik yüklenirken birkaç kez başa alarak sayfanın tepeden açılmasını garantiliyoruz.
function useResetInitialScroll() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("scrollRestoration" in window.history) {
      window.history.scrollRestoration = "manual";
    }

    let active = true;
    const scrollToTop = () => {
      if (active) window.scrollTo(0, 0);
    };
    // Geri gitme sırasındaki konum hatırlama davranışını kaybetmemek için
    // ilk yükleme penceresi kapandığında tarayıcıya kontrolü geri veriyoruz.
    const stop = () => {
      if (!active) return;
      active = false;
      if ("scrollRestoration" in window.history) {
        window.history.scrollRestoration = "auto";
      }
    };

    scrollToTop();
    const frame = requestAnimationFrame(scrollToTop);
    const timers = [
      window.setTimeout(scrollToTop, 80),
      window.setTimeout(scrollToTop, 300),
      window.setTimeout(stop, 600),
    ];

    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("keydown", stop);

    return () => {
      stop();
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("keydown", stop);
    };
  }, []);
}

type ShellKind = "admin" | "loading" | "auth" | "app";

// Giriş ekranında klavye açıldığında iOS sayfayı kaydırıyor ve bu konum giriş
// sonrasında ana sayfaya taşınıyor. Ekran tipi her değiştiğinde başa dönüyoruz.
function useScrollTopOnShellChange(shellKind: ShellKind) {
  const previousShellKind = useRef<ShellKind | null>(null);

  useEffect(() => {
    const changed =
      previousShellKind.current !== null && previousShellKind.current !== shellKind;
    previousShellKind.current = shellKind;
    if (!changed) return;

    // Klavye kapanırken iOS kaydırma konumunu geri koyabildiği için birkaç kez deniyoruz.
    const scrollToTop = () => window.scrollTo(0, 0);
    scrollToTop();
    const frame = requestAnimationFrame(scrollToTop);
    const timer = window.setTimeout(scrollToTop, 150);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [shellKind]);
}

function LoadingShell() {
  return (
    <div className="min-h-dvh w-full bg-[#FBF9F5]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md items-center justify-center px-6 text-sm text-luma-muted">
        Yükleniyor...
      </div>
    </div>
  );
}

function AuthRouteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-[#FBF9F5]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pb-10 pt-[max(20px,env(safe-area-inset-top))]">
        {children}
      </div>
    </div>
  );
}

function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="admin-shell min-h-dvh w-full overflow-x-clip bg-[#FBF9F5]">
      {children}
    </div>
  );
}

function ProtectedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, enabled, adminChecking, isAdmin, signOutUser } = useAuth();
  const lastSession = useSyncExternalStore(
    subscribeLastBrandSession,
    readLastBrandSession,
    getServerLastBrandSession,
  );
  const onLoginRoute = pathname.startsWith("/giris");
  const onCanonicalAdminRoute = pathname.startsWith("/admin");
  const onAdminRoute =
    onCanonicalAdminRoute || /^\/adm(?:i|ı)n(?:\/|$)/i.test(pathname);
  const onBrandRoute = !onLoginRoute && !onAdminRoute;
  const canPaintBrandFromCache =
    onBrandRoute &&
    Boolean(lastSession?.uid) &&
    lastSession?.isAdmin !== true;

  useEffect(() => {
    if (!enabled || loading) return;

    if (onAdminRoute && !onCanonicalAdminRoute) {
      const normalized = pathname.replace(/^\/adm(?:i|ı)n/i, "/admin");
      router.replace(normalized);
      return;
    }

    if (user && isAdmin && onBrandRoute) {
      void signOutUser().then(() => {
        router.replace("/giris");
      });
      return;
    }

    if (!user && onBrandRoute) {
      router.replace("/giris");
      return;
    }

    if (user && onLoginRoute && !adminChecking) {
      router.replace(isAdmin ? "/admin" : "/");
    }
  }, [
    enabled,
    loading,
    user,
    isAdmin,
    adminChecking,
    onLoginRoute,
    onAdminRoute,
    onBrandRoute,
    onCanonicalAdminRoute,
    pathname,
    router,
    signOutUser,
  ]);

  const shellKind: ShellKind = onAdminRoute
    ? "admin"
    : (enabled && loading && !canPaintBrandFromCache) ||
        (enabled && user && isAdmin && onBrandRoute) ||
        (enabled && !user && !loading && onBrandRoute)
      ? "loading"
      : onLoginRoute
        ? "auth"
        : "app";

  useScrollTopOnShellChange(shellKind);

  if (shellKind === "admin") {
    return <AdminShell>{children}</AdminShell>;
  }

  if (shellKind === "loading") {
    return <LoadingShell />;
  }

  if (shellKind === "auth") {
    return <AuthRouteShell>{children}</AuthRouteShell>;
  }

  return (
    <JobsProvider key={enabled ? user?.uid ?? lastSession?.uid ?? "public" : "public"}>
      <HeaderCountProvider>
        <div className="min-h-dvh w-full bg-[#FBF9F5]">
          <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
            <Header />
            <main className="flex-1 px-4 pb-32 pt-2">{children}</main>
          </div>
          <BottomNav />
        </div>
      </HeaderCountProvider>
    </JobsProvider>
  );
}

function useAppHaptics() {
  useEffect(() => bindAppHaptics(), []);
}

export function AppShell({ children }: { children: ReactNode }) {
  useResetInitialScroll();
  useAppHaptics();

  return (
    <AuthProvider>
      <ProtectedShell>{children}</ProtectedShell>
    </AuthProvider>
  );
}
