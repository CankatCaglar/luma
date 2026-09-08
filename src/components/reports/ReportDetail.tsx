"use client";

import { BarChart3, ExternalLink, Eye, Info } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { formatMonth } from "@/lib/format";
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

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80">
        <h1 className="flex items-start gap-2 text-lg font-bold leading-7 text-foreground">
          <BarChart3 className="mt-[5px] size-[1em] shrink-0 text-luma" strokeWidth={2} />
          <span className="min-w-0">{formatMonth(report.month, locale)}</span>
        </h1>
        <p className="mt-0.5 text-sm text-luma-muted">{report.title}</p>
        <p className="mt-4 text-sm leading-relaxed text-luma-muted">
          {t("reports.detailDescription")}
        </p>
      </section>

      <section className="rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80">
        <h2 className="flex items-start gap-2 text-base font-bold leading-6 text-foreground">
          <Eye className="mt-[4px] size-[1em] shrink-0 text-luma" strokeWidth={2} />
          {t("reports.accessTitle")}
        </h2>
        <div className="mt-2 divide-y divide-luma-border rounded-xl border border-luma-border">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-luma-muted">{t("reports.documentType")}</span>
            <span className="text-sm font-semibold text-foreground">
              {hasLink && link ? reportSourceLabel(link) : t("reports.kind")}
            </span>
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
            <ExternalLink className="h-[1em] w-[1em]" strokeWidth={2} />
            {reportActionLabel(link)}
          </a>
        ) : null}
      </section>

      <p className="flex items-start gap-2 px-0.5 py-1 text-sm leading-5 text-luma">
        <Info className="mt-[3px] size-3.5 shrink-0" strokeWidth={2} />
        <span>{t("reports.help")}</span>
      </p>
    </div>
  );
}
