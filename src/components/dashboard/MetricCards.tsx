"use client";

import Link from "next/link";
import { Briefcase, CheckCircle2, CircleCheck } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import type { DashboardMetrics } from "@/types";

export function MetricCards({
  metrics,
  loading = false,
  pendingCompleted = false,
}: {
  metrics?: DashboardMetrics;
  loading?: boolean;
  pendingCompleted?: boolean;
}) {
  const { t } = useI18n();

  const cards = [
    {
      href: "/isler/onay",
      label: t("dashboard.metrics.pendingApproval"),
      value: metrics?.pendingApproval ?? 0,
      footer: t("dashboard.metrics.pendingApprovalFooter"),
      icon: CircleCheck,
      wrap: "bg-gradient-to-b from-[#f4f2fc] to-luma-soft",
      iconWrap: "bg-white text-luma",
      labelClass: "text-luma",
    },
    {
      href: "/isler/aktif",
      label: t("dashboard.metrics.activeJobs"),
      value: metrics?.activeJobs ?? 0,
      footer: t("dashboard.metrics.activeJobsFooter"),
      icon: Briefcase,
      wrap: "bg-gradient-to-b from-[#fcf6ee] to-luma-gold-soft",
      iconWrap: "bg-white text-luma-kahve",
      labelClass: "text-luma-kahve",
    },
    {
      href: "/isler/tamamlanan",
      label: t("dashboard.metrics.completedThisMonth"),
      value: metrics?.completedThisMonth ?? 0,
      footer: t("dashboard.metrics.completedThisMonthFooter"),
      icon: CheckCircle2,
      wrap: "bg-gradient-to-b from-[#f1faf5] to-luma-green-soft",
      iconWrap: "bg-white text-luma-green",
      labelClass: "text-luma-green",
      pending: pendingCompleted,
    },
  ];

  return (
    <div className="grid grid-cols-3 gap-2.5">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Link
            key={card.label}
            href={card.href}
            className={`flex flex-col items-center rounded-2xl px-1.5 py-3 text-center ${card.wrap}`}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full ${card.iconWrap}`}
            >
              <Icon className="h-4 w-4" strokeWidth={2.2} />
            </div>
            <p
              className={`mt-2 w-full whitespace-nowrap text-[9px] font-semibold leading-none tracking-tight ${card.labelClass}`}
            >
              {card.label}
            </p>
            <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">
              {loading || ("pending" in card && card.pending) ? (
                <span className="inline-block h-7 w-8 animate-pulse rounded-md bg-luma-border/80" />
              ) : (
                card.value
              )}
            </p>
            <p className="mt-0.5 whitespace-nowrap text-[10px] leading-tight text-luma-muted">
              {card.footer}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
