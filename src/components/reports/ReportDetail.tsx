"use client";

import { BarChart3, ExternalLink, Info } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { IconTile } from "@/components/ui/IconTile";
import { formatDueDate, formatMonth } from "@/lib/format";
import type { MonthlyReport } from "@/types";

function reportSourceLabel(url: string) {
  if (/presentation\/d\//i.test(url)) return "Google Slides";
  if (/document\/d\//i.test(url)) return "Google Docs";
  return "Google Drive";
}

function reportActionLabel(url: string) {
  if (/presentation\/d\//i.test(url)) return "Google Slides'ta Görüntüle";
  if (/document\/d\//i.test(url)) return "Google Docs'ta Görüntüle";
  return "Drive'da Görüntüle";
}

export function ReportDetail({ report }: { report: MonthlyReport }) {
  const { t, locale } = useI18n();
  const link = report.driveUrl || undefined;
  const hasLink = Boolean(link);
  const summaryDate = report.updatedAt
    ? formatDueDate(report.updatedAt, locale)
    : formatMonth(report.month, locale);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80">
        <div className="flex items-start gap-3">
          <IconTile tone="purple">
            <BarChart3 className="h-5 w-5" strokeWidth={1.8} />
          </IconTile>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-foreground">
              {formatMonth(report.month, locale)}
            </h1>
            <p className="mt-0.5 text-sm text-luma-muted">{report.title}</p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-luma-muted">
          {t("reports.detailDescription")}
        </p>
      </section>

      <section className="rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80">
        <h2 className="text-base font-bold text-foreground">{t("reports.accessTitle")}</h2>
        <div className="mt-2 divide-y divide-luma-border rounded-xl border border-luma-border">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-luma-muted">{t("reports.documentType")}</span>
            <span className="text-sm font-semibold text-foreground">
              {hasLink && link ? reportSourceLabel(link) : t("reports.kind")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-luma-muted">{t("reports.lastUpdate")}</span>
            <span className="text-sm font-semibold text-foreground">{summaryDate}</span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-luma-muted">{t("reports.sharing")}</span>
            <span className="text-sm font-semibold text-foreground">
              {hasLink ? t("reports.viewOnly") : t("reports.linkPending")}
            </span>
          </div>
        </div>

        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full select-none items-center justify-center gap-2 rounded-xl bg-luma py-3 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
            {reportActionLabel(link)}
          </a>
        ) : null}
      </section>

      <section className="rounded-2xl bg-luma-soft px-3.5 py-3 text-sm text-luma">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("reports.help")}</span>
        </p>
      </section>
    </div>
  );
}
