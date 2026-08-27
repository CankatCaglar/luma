"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef } from "react";
import { ChevronDown, ChevronLeft } from "lucide-react";
import { currentBrand, currentUser } from "@/data/mock";
import { useI18n } from "@/components/i18n/I18nProvider";
import { LumaLogo } from "@/components/layout/NeraLogo";
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

export function Header() {
  const { t } = useI18n();
  const pathname = usePathname();
  const entryPath = useRef<string | null>(null);
  if (entryPath.current === null) {
    entryPath.current = pathname;
  }
  const back = backRoutes.find((route) => route.match(pathname));

  return (
    <header className="sticky top-0 z-40 flex items-center justify-between border-b border-black/[0.03] bg-[#FBF9F5]/90 px-4 pb-3 pt-[max(12px,env(safe-area-inset-top))] backdrop-blur-md">
      {back ? (
        <BackButton
          fallbackHref={back.href}
          label={t("header.back")}
          canGoBack={entryPath.current !== pathname}
        />
      ) : (
        <Link
          href="/"
          prefetch={false}
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

      <Link
        href="/hesabim"
        className="flex shrink-0 select-none items-center gap-1.5 transition-transform duration-150 ease-out active:scale-[0.97]"
        aria-label={t("header.brandSelector")}
      >
        <Image
          src={currentUser.avatarUrl}
          alt={currentBrand.name}
          width={36}
          height={36}
          priority
          unoptimized
          className="h-9 w-9 rounded-full bg-luma-soft object-cover ring-2 ring-white"
        />
        <ChevronDown className="h-4 w-4 text-luma" strokeWidth={2} />
      </Link>
    </header>
  );
}
