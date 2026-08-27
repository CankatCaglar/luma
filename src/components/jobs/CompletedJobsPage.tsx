"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FileDown } from "lucide-react";
import { JobList } from "@/components/jobs/JobList";
import { jobKindKeys } from "@/components/jobs/jobMeta";
import { useI18n } from "@/components/i18n/I18nProvider";
import {
  buildCompletedCsv,
  buildCompletedTxt,
  downloadTextFile,
  reportFilename,
} from "@/lib/completedReport";
import { formatDueDate } from "@/lib/format";
import { isWithinLastMonths, PERIOD_OPTIONS } from "@/lib/period";
import { cn } from "@/lib/cn";
import type { Brand, Job, PeriodMonths } from "@/types";
import type { MessageKey } from "@/i18n";

const periodKeys: Record<PeriodMonths, MessageKey> = {
  1: "jobs.completed.period1",
  3: "jobs.completed.period3",
  6: "jobs.completed.period6",
  12: "jobs.completed.period12",
};

export function CompletedJobsPage({
  jobs,
  brand,
  referenceNowIso,
}: {
  jobs: Job[];
  brand: Brand;
  referenceNowIso: string;
}) {
  const { t, locale } = useI18n();
  const now = useMemo(() => new Date(referenceNowIso), [referenceNowIso]);
  const [months, setMonths] = useState<PeriodMonths>(1);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const periodRef = useRef<HTMLDivElement>(null);
  const exportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (!periodRef.current?.contains(target)) setPeriodOpen(false);
      if (!exportRef.current?.contains(target)) setExportOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const visible = useMemo(
    () =>
      jobs.filter(
        (job) =>
          job.completedAt && isWithinLastMonths(job.completedAt, months, now),
      ),
    [jobs, months, now],
  );

  const subtitle =
    months === 1
      ? t("jobs.completed.subtitle")
      : t("jobs.completed.subtitlePeriod", { months });

  function closeMenus() {
    setPeriodOpen(false);
    setExportOpen(false);
  }

  function exportCsv() {
    const csv = buildCompletedCsv(
      visible,
      brand.name,
      (kind) => t(jobKindKeys[kind]),
      locale,
    );
    downloadTextFile(
      reportFilename(brand.id, months, "csv"),
      csv,
      "text/csv;charset=utf-8",
    );
    closeMenus();
  }

  function exportTxt() {
    const txt = buildCompletedTxt({
      jobs: visible,
      brandName: brand.name,
      periodLabel: t("jobs.completed.reportPeriod", {
        period: t(periodKeys[months]),
      }),
      generatedLabel: t("jobs.completed.reportGenerated", {
        date: formatDueDate(now.toISOString().slice(0, 10), locale),
      }),
      title: t("jobs.completed.reportTitle"),
      locale,
    });
    downloadTextFile(
      reportFilename(brand.id, months, "txt"),
      txt,
      "text/plain;charset=utf-8",
    );
    closeMenus();
  }

  return (
    <div>
      <p className="text-sm text-luma-kahve">{subtitle}</p>
      <div className="mt-3 flex gap-2">
        <div ref={periodRef} className="relative min-w-0 flex-1">
          <button
            type="button"
            aria-expanded={periodOpen}
            aria-haspopup="listbox"
            aria-label={t("jobs.completed.period")}
            onClick={() => {
              setExportOpen(false);
              setPeriodOpen((open) => !open);
            }}
            className="flex w-full select-none items-center justify-between rounded-xl bg-luma-card px-3 py-2.5 text-sm font-medium text-foreground ring-1 ring-luma-border transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <span className="truncate">{t(periodKeys[months])}</span>
            <ChevronDown className="h-4 w-4 shrink-0 text-luma" />
          </button>
          {periodOpen ? (
            <ul
              role="listbox"
              className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-luma-border"
            >
              {PERIOD_OPTIONS.map((option) => (
                <li key={option}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={option === months}
                    onClick={() => {
                      setMonths(option);
                      setPeriodOpen(false);
                    }}
                    className={cn(
                      "w-full px-3 py-2.5 text-left text-sm",
                      option === months
                        ? "bg-luma-soft font-semibold text-luma"
                        : "text-foreground",
                    )}
                  >
                    {t(periodKeys[option])}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div ref={exportRef} className="relative shrink-0">
          <button
            type="button"
            disabled={visible.length === 0}
            aria-expanded={exportOpen}
            onClick={() => {
              setPeriodOpen(false);
              setExportOpen((open) => !open);
            }}
            className="flex select-none items-center gap-1.5 rounded-xl bg-luma px-3 py-2.5 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <FileDown className="h-4 w-4" />
            {t("jobs.completed.export")}
          </button>
          {exportOpen ? (
            <ul className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl bg-white py-1 shadow-lg ring-1 ring-luma-border">
              <li>
                <button
                  type="button"
                  onClick={exportCsv}
                  className="w-full px-3 py-2.5 text-left text-sm text-foreground"
                >
                  {t("jobs.completed.exportCsv")}
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={exportTxt}
                  className="w-full px-3 py-2.5 text-left text-sm text-foreground"
                >
                  {t("jobs.completed.exportTxt")}
                </button>
              </li>
            </ul>
          ) : null}
        </div>
      </div>

      <div className="mt-4">
        <JobList
          jobs={visible}
          emptyLabel={t("jobs.completed.empty")}
          dateKind="completed"
        />
      </div>
    </div>
  );
}
