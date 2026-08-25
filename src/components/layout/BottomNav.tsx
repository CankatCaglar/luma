"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Home, User } from "lucide-react";
import { unreadNotificationCount } from "@/data/mock";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/cn";

const items = [
  {
    href: "/",
    key: "nav.home" as const,
    icon: Home,
    match: (path: string) => path === "/",
  },
  {
    href: "/bildirimler",
    key: "nav.notifications" as const,
    icon: Bell,
    match: (path: string) => path.startsWith("/bildirimler"),
    badge: unreadNotificationCount > 0,
  },
  {
    href: "/hesabim",
    key: "nav.account" as const,
    icon: User,
    match: (path: string) => path.startsWith("/hesabim"),
  },
];

export function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-999 flex justify-center">
      <nav className="pointer-events-auto flex w-full max-w-md items-center justify-around border-t border-slate-100/80 bg-white/95 px-6 pb-[max(20px,env(safe-area-inset-bottom))] pt-2 shadow-sm backdrop-blur-md">
        {items.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "relative flex select-none flex-col items-center gap-1 text-[11px] font-medium transition-transform duration-150 ease-out active:scale-[0.97]",
                active ? "text-luma" : "text-luma-muted",
              )}
            >
              {active ? (
                <span className="absolute -top-2 h-1 w-8 rounded-full bg-luma" />
              ) : null}
              <span className="relative">
                <Icon
                  className="h-5 w-5"
                  strokeWidth={active ? 2.4 : 1.8}
                  fill={active && item.href === "/" ? "currentColor" : "none"}
                />
                {"badge" in item && item.badge ? (
                  <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-luma ring-2 ring-white" />
                ) : null}
              </span>
              <span>{t(item.key)}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
