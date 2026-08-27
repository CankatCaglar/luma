"use client";

import Link from "next/link";
import { ChevronRight, FileSpreadsheet } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { IconTile } from "@/components/ui/IconTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMonth } from "@/lib/format";
import { statusKeys } from "@/components/jobs/jobMeta";
import type { ContentPlan } from "@/types";

export function PlansList({ plans }: { plans: ContentPlan[] }) {
  const { t, locale } = useI18n();

  return (
    <div>
      <p className="mb-4 text-sm text-luma-kahve">{t("plans.subtitle")}</p>
      {plans.length === 0 ? (
        <p className="rounded-2xl bg-luma-card px-4 py-8 text-center text-sm text-luma-muted ring-1 ring-luma-border/80">
          {t("plans.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {plans.map((plan) => (
            <Link
              key={plan.id}
              href={`/planlar/${plan.id}`}
              className="flex select-none items-center gap-3 rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80 transition-transform duration-150 ease-out active:scale-[0.99]"
            >
              <IconTile tone="gold">
                <FileSpreadsheet className="h-5 w-5" strokeWidth={1.8} />
              </IconTile>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-foreground">
                    {formatMonth(plan.month, locale)}
                  </h2>
                  {plan.isCurrent ? (
                    <span className="rounded-full bg-luma-soft px-2 py-0.5 text-[10px] font-semibold text-luma">
                      {t("plans.current")}
                    </span>
                  ) : null}
                </div>
                <div className="mt-1">
                  <StatusBadge
                    status={plan.status}
                    label={t(statusKeys[plan.status])}
                  />
                </div>
              </div>
              <span className="inline-flex shrink-0 select-none items-center gap-0.5 text-sm font-semibold text-luma">
                {t("plans.view")}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
