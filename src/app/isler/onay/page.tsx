"use client";

import { JobList } from "@/components/jobs/JobList";
import { pendingJobs } from "@/data/mock";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function OnayIslerPage() {
  const { t } = useI18n();

  return (
    <div>
      <p className="mb-4 text-sm text-luma-kahve">{t("jobs.pending.subtitle")}</p>
      <JobList jobs={pendingJobs} emptyLabel={t("jobs.empty")} dateKind="due" />
    </div>
  );
}
