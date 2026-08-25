"use client";

import Link from "next/link";
import { BarChart3, Calendar, Folder, Plus } from "lucide-react";
import { quickLinks } from "@/data/mock";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { MessageKey } from "@/i18n";
import type { QuickLinkId } from "@/types";

const meta: Record<
  QuickLinkId,
  {
    title: MessageKey;
    subtitle: MessageKey;
    icon: typeof Plus;
    iconClass: string;
  }
> = {
  request: {
    title: "dashboard.quickAccess.newRequest",
    subtitle: "dashboard.quickAccess.newRequestSub",
    icon: Plus,
    iconClass: "bg-luma",
  },
  plans: {
    title: "dashboard.quickAccess.plans",
    subtitle: "dashboard.quickAccess.plansSub",
    icon: Calendar,
    iconClass: "bg-luma-gold",
  },
  reports: {
    title: "dashboard.quickAccess.reports",
    subtitle: "dashboard.quickAccess.reportsSub",
    icon: BarChart3,
    iconClass: "bg-luma",
  },
  brand: {
    title: "dashboard.quickAccess.brandCenter",
    subtitle: "dashboard.quickAccess.brandCenterSub",
    icon: Folder,
    iconClass: "bg-luma-kahve",
  },
};

export function QuickAccess() {
  const { t } = useI18n();

  return (
    <section>
      <h2 className="mb-3 text-base font-bold text-foreground">
        {t("dashboard.quickAccess.title")}
      </h2>
      <div className="grid grid-cols-4 gap-2">
        {quickLinks.map((link) => {
          const item = meta[link.id];
          const Icon = item.icon;
          return (
            <Link
              key={link.id}
              href={link.href}
              className="flex select-none flex-col items-center rounded-2xl bg-luma-card px-1.5 py-3 text-center ring-1 ring-luma-border/80 transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              <span
                className={`flex h-10 w-10 items-center justify-center rounded-xl text-white ${item.iconClass}`}
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              <span className="mt-2 text-[11px] font-bold leading-tight text-foreground">
                {t(item.title)}
              </span>
              <span className="mt-0.5 text-[9px] leading-tight text-luma-muted">
                {t(item.subtitle)}
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
