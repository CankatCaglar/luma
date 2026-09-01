"use client";

import Link from "next/link";
import { BarChart3, ChevronRight, ExternalLink } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { IconTile } from "@/components/ui/IconTile";
import { formatMonth } from "@/lib/format";
import type { MonthlyReport } from "@/types";

const cardClass =
  "flex select-none items-center gap-3 rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80 transition-transform duration-150 ease-out active:scale-[0.99]";

export function ReportsList({ reports }: { reports: MonthlyReport[] }) {
  const { t, locale } = useI18n();

  return (
    <div>
      <p className="mb-4 text-sm text-luma-kahve">{t("reports.subtitle")}</p>
      {reports.length === 0 ? (
        <p className="rounded-2xl bg-luma-card px-4 py-8 text-center text-sm text-luma-muted ring-1 ring-luma-border/80">
          {t("reports.empty")}
        </p>
      ) : (
        <div className="space-y-3">
          {reports.map((report, index) => {
            const driveUrl = report.driveUrl?.trim();
            const body = (
              <>
                <IconTile tone={index % 2 === 0 ? "purple" : "gold"}>
                  <BarChart3 className="h-5 w-5" strokeWidth={1.8} />
                </IconTile>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h2 className="truncate font-semibold text-foreground">
                      {formatMonth(report.month, locale)}
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
                </div>
                <span className="inline-flex shrink-0 select-none items-center gap-0.5 text-sm font-semibold text-luma">
                  {driveUrl ? t("reports.view") : t("reports.linkPending")}
                  {driveUrl ? <ExternalLink className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </span>
              </>
            );

            if (driveUrl) {
              return (
                <a
                  key={report.id}
                  href={driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={cardClass}
                >
                  {body}
                </a>
              );
            }

            return (
              <Link key={report.id} href={`/raporlar/${report.id}`} className={cardClass}>
                {body}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
