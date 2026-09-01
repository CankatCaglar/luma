"use client";

import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { JobsProvider } from "@/components/jobs/JobsProvider";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";
import {
  readLastBrandSession,
  subscribeLastBrandSession,
} from "@/lib/session/lastBrandSession";

function getServerLastBrandSession() {
  return null;
}

function LoadingShell() {
  return (
    <div className="min-h-screen w-full bg-[#FBF9F5]">
      <div className="mx-auto flex min-h-screen w-full max-w-md items-center justify-center px-6 text-sm text-luma-muted">
        Yükleniyor...
      </div>
    </div>
  );
}

function AuthRouteShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#FBF9F5]">
      <div className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-10 pt-[max(20px,env(safe-area-inset-top))]">
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

  if (onAdminRoute) {
    return <AdminShell>{children}</AdminShell>;
  }

  if (enabled && loading && !canPaintBrandFromCache) return <LoadingShell />;
  if (enabled && user && isAdmin && onBrandRoute) return <LoadingShell />;
  if (enabled && !user && !loading && onBrandRoute) return <LoadingShell />;

  if (onLoginRoute) {
    return <AuthRouteShell>{children}</AuthRouteShell>;
  }

  return (
    <JobsProvider key={enabled ? user?.uid ?? lastSession?.uid ?? "public" : "public"}>
      <div className="min-h-screen w-full bg-[#FBF9F5]">
        <div className="mx-auto flex min-h-screen w-full max-w-md flex-col">
          <Header />
          <main className="flex-1 px-4 pb-32 pt-2">{children}</main>
        </div>
        <BottomNav />
      </div>
    </JobsProvider>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ProtectedShell>{children}</ProtectedShell>
    </AuthProvider>
  );
}
