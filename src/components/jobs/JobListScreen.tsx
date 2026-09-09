"use client";

import { JobList } from "@/components/jobs/JobList";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useHeaderCount } from "@/components/layout/Header";
import type { Job } from "@/types";
import type { MessageKey } from "@/i18n";

type DateKind = "delivery" | "due" | "completed";

export function JobListScreen({
  jobs,
  subtitleKey,
  dateKind,
}: {
  jobs: Job[];
  subtitleKey: MessageKey;
  dateKind: DateKind;
}) {
  const { t } = useI18n();
  useHeaderCount(jobs.length);

  return (
    <div>
      <p className="mb-4 text-sm text-luma-kahve">{t(subtitleKey)}</p>
      <JobList jobs={jobs} emptyLabel={t("jobs.empty")} dateKind={dateKind} />
    </div>
  );
}
