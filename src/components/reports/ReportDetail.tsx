"use client";

import { BarChart3, ExternalLink } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { IconTile } from "@/components/ui/IconTile";
import { formatMonth } from "@/lib/format";
import type { MonthlyReport } from "@/types";

export function ReportDetail({ report }: { report: MonthlyReport }) {
  const { t, locale } = useI18n();
  const hasLink = Boolean(report.driveUrl);

  return (
    <div>
      <div className="rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80">
        <div className="flex items-start gap-3">
          <IconTile tone="purple">
            <BarChart3 className="h-5 w-5" strokeWidth={1.8} />
          </IconTile>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-foreground">
              {formatMonth(report.month, locale)}
            </h1>
            <p className="mt-0.5 text-sm text-luma-muted">{t("reports.kind")}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-luma-muted">
          {hasLink ? t("reports.comingSoonWithLink") : t("reports.comingSoon")}
        </p>
        {hasLink ? (
          <a
            href={report.driveUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full select-none items-center justify-center gap-2 rounded-xl bg-luma py-3 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
            {t("reports.openDrive")}
          </a>
        ) : null}
      </div>
    </div>
  );
}
