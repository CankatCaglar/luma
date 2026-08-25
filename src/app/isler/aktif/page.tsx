"use client";

import { JobList } from "@/components/jobs/JobList";
import { activeJobs } from "@/data/mock";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function AktifIslerPage() {
  const { t } = useI18n();

  return (
    <div>
      <p className="mb-4 text-sm text-luma-kahve">{t("jobs.active.subtitle")}</p>
      <JobList jobs={activeJobs} emptyLabel={t("jobs.empty")} dateKind="delivery" />
    </div>
  );
}
