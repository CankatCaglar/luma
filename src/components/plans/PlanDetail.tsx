"use client";

import { ExternalLink, FileSpreadsheet } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { IconTile } from "@/components/ui/IconTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusKeys } from "@/components/jobs/jobMeta";
import { formatMonth } from "@/lib/format";
import type { ContentPlan } from "@/types";

export function PlanDetail({ plan }: { plan: ContentPlan }) {
  const { t, locale } = useI18n();
  const hasLink = Boolean(plan.slidesUrl);

  return (
    <div>
      <div className="rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80">
        <div className="flex items-start gap-3">
          <IconTile tone="gold">
            <FileSpreadsheet className="h-5 w-5" strokeWidth={1.8} />
          </IconTile>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-foreground">
              {formatMonth(plan.month, locale)}
            </h1>
            <p className="mt-0.5 text-sm text-luma-muted">{plan.title}</p>
            <div className="mt-2">
              <StatusBadge
                status={plan.status}
                label={t(statusKeys[plan.status])}
              />
            </div>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-luma-muted">
          {hasLink ? t("plans.comingSoonWithLink") : t("plans.comingSoon")}
        </p>
        {hasLink ? (
          <a
            href={plan.slidesUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full select-none items-center justify-center gap-2 rounded-xl bg-luma py-3 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
            {t("plans.openSlides")}
          </a>
        ) : null}
      </div>
    </div>
  );
}
