"use client";

import { BarChart3, ChevronRight } from "lucide-react";
import { monthlyReports } from "@/data/mock";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconTile } from "@/components/ui/IconTile";
import { formatMonth } from "@/lib/format";

export default function RaporlarPage() {
  const { t, locale } = useI18n();

  return (
    <div>
      <PageHeader title={t("reports.title")} subtitle={t("reports.subtitle")} />
      <div className="space-y-3">
        {monthlyReports.map((report, index) => (
          <article
            key={report.id}
            className="flex select-none items-center gap-3 rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80 transition-transform duration-150 ease-out active:scale-[0.99]"
          >
            <IconTile tone={index % 2 === 0 ? "purple" : "gold"}>
              <BarChart3 className="h-5 w-5" strokeWidth={1.8} />
            </IconTile>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <h2 className="truncate font-semibold text-foreground">
                  {report.title}
                </h2>
                {report.isNew ? (
                  <span className="rounded-full bg-luma-gold-soft px-2 py-0.5 text-[10px] font-semibold text-luma-kahve">
                    {t("reports.new")}
                  </span>
                ) : null}
              </div>
              <p className="mt-0.5 text-sm text-luma-muted">
                {t("reports.kind")}
              </p>
              <p className="sr-only">{formatMonth(report.month, locale)}</p>
            </div>
            <a
              href={report.driveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 select-none items-center gap-0.5 text-sm font-semibold text-luma transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              {t("reports.view")}
              <ChevronRight className="h-4 w-4" />
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
