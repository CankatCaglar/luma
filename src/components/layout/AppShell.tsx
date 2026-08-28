"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BottomNav } from "@/components/layout/BottomNav";
import { Header } from "@/components/layout/Header";
import { JobsProvider } from "@/components/jobs/JobsProvider";
import { AuthProvider, useAuth } from "@/components/auth/AuthProvider";

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
    <div className="min-h-screen w-full bg-slate-50">
      <main className="mx-auto w-full max-w-7xl px-6 py-8">{children}</main>
    </div>
  );
}

function ProtectedShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading, enabled, adminChecking } = useAuth();
  const onLoginRoute = pathname.startsWith("/giris");
  const onCanonicalAdminRoute = pathname.startsWith("/admin");
  const onAdminRoute =
    onCanonicalAdminRoute || /^\/adm(?:i|ı)n(?:\/|$)/i.test(pathname);

  useEffect(() => {
    if (!enabled || loading) return;

    if (onAdminRoute && !onCanonicalAdminRoute) {
      const normalized = pathname.replace(/^\/adm(?:i|ı)n/i, "/admin");
      router.replace(normalized);
      return;
    }

    if (!user && !onLoginRoute && !onAdminRoute) router.replace("/giris");
    if (user && onLoginRoute) router.replace("/");
  }, [enabled, loading, user, onLoginRoute, onAdminRoute, onCanonicalAdminRoute, pathname, router]);

  if (enabled && loading) return <LoadingShell />;
  if (enabled && !user && !onLoginRoute && !onAdminRoute) return <LoadingShell />;
  if (enabled && onAdminRoute && user && adminChecking) return <LoadingShell />;

  if (onLoginRoute) {
    return <AuthRouteShell>{children}</AuthRouteShell>;
  }

  if (onAdminRoute) {
    return <AdminShell>{children}</AdminShell>;
  }

  return (
    <JobsProvider key={enabled ? user?.uid ?? "public" : "public"}>
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
