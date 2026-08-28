"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ChevronDown, ChevronLeft, LogOut } from "lucide-react";
import { currentBrand, currentUser } from "@/data/mock";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { LumaLogo } from "@/components/layout/NeraLogo";
import { cn } from "@/lib/cn";
import type { MessageKey } from "@/i18n";

type BackRoute = {
  match: (pathname: string) => boolean;
  titleKey: MessageKey;
  href: string;
};

const backRoutes: BackRoute[] = [
  {
    match: (pathname) => /^\/planlar\/[^/]+$/.test(pathname),
    titleKey: "plans.detailTitle",
    href: "/planlar",
  },
  {
    match: (pathname) => pathname === "/planlar",
    titleKey: "plans.title",
    href: "/",
  },
  {
    match: (pathname) => /^\/raporlar\/[^/]+$/.test(pathname),
    titleKey: "reports.detailTitle",
    href: "/raporlar",
  },
  {
    match: (pathname) => pathname === "/raporlar",
    titleKey: "reports.title",
    href: "/",
  },
  {
    match: (pathname) => /^\/isler\/gorev\/[^/]+$/.test(pathname),
    titleKey: "jobs.detail.title",
    href: "/isler",
  },
  {
    match: (pathname) => pathname === "/isler/aktif",
    titleKey: "jobs.active.title",
    href: "/",
  },
  {
    match: (pathname) => pathname === "/isler/onay",
    titleKey: "jobs.pending.title",
    href: "/",
  },
  {
    match: (pathname) => pathname === "/isler/tamamlanan",
    titleKey: "jobs.completed.title",
    href: "/",
  },
  {
    match: (pathname) => pathname === "/marka",
    titleKey: "brandCenter.title",
    href: "/",
  },
  {
    match: (pathname) => pathname === "/talep",
    titleKey: "request.title",
    href: "/",
  },
  {
    match: (pathname) => pathname === "/admin",
    titleKey: "admin.title",
    href: "/hesabim",
  },
];

function BackButton({
  fallbackHref,
  label,
  canGoBack,
}: {
  fallbackHref: string;
  label: string;
  canGoBack: boolean;
}) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => {
        if (canGoBack) {
          router.back();
          return;
        }
        router.push(fallbackHref);
      }}
      className="flex h-9 w-9 select-none items-center justify-center text-foreground transition-transform duration-150 ease-out active:scale-[0.97]"
      aria-label={label}
    >
      <ChevronLeft className="h-6 w-6" strokeWidth={1.8} />
    </button>
  );
}

function ProfileMenu() {
  const { t } = useI18n();
  const { user, signOutUser } = useAuth();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <div className="relative shrink-0">
      <button
        type="button"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((value) => !value)}
        className="flex select-none items-center gap-1.5 transition-transform duration-150 ease-out active:scale-[0.97]"
        aria-label={t("header.profileMenu")}
      >
        <Image
          src={user?.photoURL ?? currentUser.avatarUrl}
          alt={user?.displayName ?? currentBrand.name}
          width={36}
          height={36}
          priority
          unoptimized
          className="h-9 w-9 rounded-full bg-luma-soft object-cover ring-2 ring-white"
        />
        <ChevronDown
          className={cn(
            "h-4 w-4 text-luma transition-transform duration-150",
            open && "rotate-180",
          )}
          strokeWidth={2}
        />
      </button>
      {open ? (
        <>
          <button
            type="button"
            tabIndex={-1}
            aria-label={t("header.closeMenu")}
            className="fixed inset-0 z-40 cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 top-[calc(100%+10px)] z-50 w-48 overflow-hidden rounded-2xl bg-white py-1 shadow-[0_12px_40px_rgba(28,25,23,0.12)] ring-1 ring-luma-border"
          >
            {user?.email ? (
              <p className="truncate px-3.5 pb-1 pt-2 text-xs text-luma-muted">
                {user.email}
              </p>
            ) : null}
            <button
              type="button"
              role="menuitem"
              onClick={async () => {
                setLoggingOut(true);
                try {
                  await signOutUser();
                } finally {
                  setLoggingOut(false);
                  setOpen(false);
                }
              }}
              className="flex w-full select-none items-center gap-2.5 px-3.5 py-2.5 text-left text-sm font-semibold text-luma-red transition-colors hover:bg-red-50"
            >
              <LogOut className="h-4 w-4" strokeWidth={1.9} />
              {loggingOut ? "Çıkış yapılıyor..." : t("account.logout")}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
}

export function Header() {
  const { t } = useI18n();
  const pathname = usePathname();
  const back = backRoutes.find((route) => route.match(pathname));
  const canGoBack = typeof window !== "undefined" && window.history.length > 1;

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between bg-[#FBF9F5]/90 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md">
      {back ? (
        <BackButton
          fallbackHref={back.href}
          label={t("header.back")}
          canGoBack={canGoBack}
        />
      ) : (
        <Link
          href="/"
          className="flex select-none items-center transition-transform duration-150 ease-out active:scale-[0.97]"
          aria-label={t("brand.appName")}
        >
          <LumaLogo />
        </Link>
      )}

      {back ? (
        <h1 className="absolute left-1/2 max-w-[60%] -translate-x-1/2 truncate text-center text-[15px] font-bold text-foreground">
          {t(back.titleKey)}
        </h1>
      ) : null}

      <ProfileMenu />
    </header>
  );
}
