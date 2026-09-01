"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ExternalLink, FileSpreadsheet, FolderOpen } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { IconTile } from "@/components/ui/IconTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { formatMonth } from "@/lib/format";
import { statusKeys } from "@/components/jobs/jobMeta";
import type { ContentPlan, PlanYear } from "@/types";

const cardClass =
  "flex select-none items-center gap-3 rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80 transition-transform duration-150 ease-out active:scale-[0.99]";

function yearOf(month: string): string {
  return month.slice(0, 4);
}

function PlanCard({ plan }: { plan: ContentPlan }) {
  const { t, locale } = useI18n();
  const driveUrl = plan.slidesUrl?.trim();
  const body = (
    <>
      <IconTile tone="gold">
        <FileSpreadsheet className="h-5 w-5" strokeWidth={1.8} />
      </IconTile>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold text-foreground">{formatMonth(plan.month, locale)}</h2>
          {plan.isCurrent ? (
            <span className="rounded-full bg-luma-soft px-2 py-0.5 text-[10px] font-semibold text-luma">
              {t("plans.current")}
            </span>
          ) : null}
        </div>
        <div className="mt-1">
          <StatusBadge status={plan.status} label={t(statusKeys[plan.status])} />
        </div>
      </div>
      <span className="inline-flex shrink-0 select-none items-center gap-0.5 text-sm font-semibold text-luma">
        {driveUrl ? t("plans.view") : t("plans.linkPending")}
        {driveUrl ? <ExternalLink className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
      </span>
    </>
  );

  if (driveUrl) {
    return (
      <a href={driveUrl} target="_blank" rel="noopener noreferrer" className={cardClass}>
        {body}
      </a>
    );
  }

  return (
    <Link href={`/planlar/${plan.id}`} prefetch className={cardClass}>
      {body}
    </Link>
  );
}

export function PlansList({
  plans,
  folderUrl,
  folderTitle,
  planYears,
}: {
  plans: ContentPlan[];
  folderUrl?: string;
  folderTitle?: string;
  planYears?: PlanYear[];
}) {
  const { t } = useI18n();
  const currentYear = String(new Date().getFullYear());
  const years = useMemo(() => {
    const fromPlans = plans.map((plan) => yearOf(plan.month)).filter((year) => /^20\d{2}$/.test(year));
    const fromFolders = (planYears ?? []).map((item) => item.year).filter((year) => /^20\d{2}$/.test(year));
    return [...new Set([...fromFolders, ...fromPlans])].sort((left, right) =>
      right.localeCompare(left),
    );
  }, [plans, planYears]);

  const defaultYear = years.includes(currentYear) ? currentYear : (years[0] ?? currentYear);
  const [selectedYear, setSelectedYear] = useState(defaultYear);

  useEffect(() => {
    if (!years.length) return;
    if (years.includes(selectedYear)) return;
    setSelectedYear(years.includes(currentYear) ? currentYear : years[0]);
  }, [years, selectedYear, currentYear]);

  const selectedPlans = plans.filter((plan) => yearOf(plan.month) === selectedYear);
  const selectedFolder = (planYears ?? []).find((item) => item.year === selectedYear);
  const selectedFolderUrl = selectedFolder?.url || (years.length <= 1 ? folderUrl : undefined);
  const isArchive = selectedYear < currentYear;
  const showYearSwitch = years.length > 1;
  const empty = plans.length === 0 && !folderUrl && !years.length;

  return (
    <div>
      <p className="mb-4 text-sm text-luma-kahve">{t("plans.subtitle")}</p>
      {empty ? (
        <p className="rounded-2xl bg-luma-card px-4 py-8 text-center text-sm text-luma-muted ring-1 ring-luma-border/80">
          {t("plans.empty")}
        </p>
      ) : (
        <div className="space-y-4">
          {showYearSwitch ? (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {years.map((year) => {
                const active = year === selectedYear;
                return (
                  <button
                    key={year}
                    type="button"
                    onClick={() => setSelectedYear(year)}
                    className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                      active
                        ? "bg-luma text-white"
                        : "bg-luma-card text-luma-kahve ring-1 ring-luma-border/80"
                    }`}
                  >
                    {year}
                    {year === currentYear ? (
                      <span className={`ml-1.5 text-[10px] font-semibold ${active ? "text-white/80" : "text-luma"}`}>
                        {t("plans.current")}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          {selectedFolderUrl ? (
            <a
              href={selectedFolderUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={cardClass}
            >
              <IconTile tone={isArchive ? "gold" : "purple"}>
                <FolderOpen className="h-5 w-5" strokeWidth={1.8} />
              </IconTile>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="font-semibold text-foreground">
                    {t("plans.yearHeading", { year: selectedYear })}
                  </h2>
                  {isArchive ? (
                    <span className="rounded-full bg-luma-gold-soft px-2 py-0.5 text-[10px] font-semibold text-luma-kahve">
                      {t("plans.archive")}
                    </span>
                  ) : null}
                </div>
                <p className="mt-0.5 text-sm text-luma-muted">
                  {isArchive ? t("plans.archiveSub") : t("plans.yearFolderSub")}
                </p>
              </div>
              <span className="inline-flex shrink-0 select-none items-center gap-0.5 text-sm font-semibold text-luma">
                {t("plans.view")}
                <ExternalLink className="h-4 w-4" />
              </span>
            </a>
          ) : folderUrl && !showYearSwitch ? (
            <a href={folderUrl} target="_blank" rel="noopener noreferrer" className={cardClass}>
              <IconTile tone="purple">
                <FolderOpen className="h-5 w-5" strokeWidth={1.8} />
              </IconTile>
              <div className="min-w-0 flex-1">
                <h2 className="font-semibold text-foreground">
                  {folderTitle || t("plans.yearFolder")}
                </h2>
                <p className="mt-0.5 text-sm text-luma-muted">{t("plans.yearFolderSub")}</p>
              </div>
              <span className="inline-flex shrink-0 select-none items-center gap-0.5 text-sm font-semibold text-luma">
                {t("plans.view")}
                <ExternalLink className="h-4 w-4" />
              </span>
            </a>
          ) : null}

          {selectedPlans.length ? (
            <div className="space-y-3">
              {selectedPlans.map((plan) => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl bg-luma-card px-4 py-8 text-center text-sm text-luma-muted ring-1 ring-luma-border/80">
              {t("plans.emptyYear", { year: selectedYear })}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
