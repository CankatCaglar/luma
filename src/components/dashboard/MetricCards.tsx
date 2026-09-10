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
      iconClass: "text-luma",
      valueClass: "text-luma",
    },
    {
      href: "/isler/aktif",
      label: t("dashboard.metrics.activeJobs"),
      value: metrics?.activeJobs ?? 0,
      footer: t("dashboard.metrics.activeJobsFooter"),
      icon: Briefcase,
      iconClass: "text-luma-kahve",
      valueClass: "text-luma-kahve",
    },
    {
      href: "/isler/tamamlanan",
      label: t("dashboard.metrics.completedThisMonth"),
      value: metrics?.completedThisMonth ?? 0,
      footer: t("dashboard.metrics.completedThisMonthFooter"),
      icon: CheckCircle2,
      iconClass: "text-luma-green",
      valueClass: "text-luma-green",
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
            className="flex flex-col items-center rounded-2xl bg-luma-card px-1.5 py-3 text-center ring-1 ring-luma-border/80"
          >
            <Icon className={`h-6 w-6 ${card.iconClass}`} strokeWidth={2.2} />
            <p className="mt-2 min-h-[1.4rem] w-full text-[9px] font-semibold leading-tight tracking-tight text-foreground">
              {card.label}
            </p>
            <p
              className={`mt-1.5 text-2xl font-bold tracking-tight ${card.valueClass}`}
            >
              {loading || ("pending" in card && card.pending) ? (
                <span className="inline-block h-7 w-8 animate-pulse rounded-md bg-luma-border/80" />
              ) : (
                card.value
              )}
            </p>
            <p className="mt-0.5 min-h-6 text-[10px] leading-tight text-luma-muted">
              {card.footer}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
