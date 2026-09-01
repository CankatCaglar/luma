"use client";

import { useParams } from "next/navigation";
import { JobDetail } from "@/components/jobs/JobDetail";
import { useJobs } from "@/components/jobs/JobsProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { MissingRecord } from "@/components/ui/MissingRecord";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { data } = useJobs();

  if (!data) return <PageSkeleton cards={3} />;
  const job = data.jobs.find((item) => item.id === id);
  if (!job) return <MissingRecord label={t("jobs.detail.missing")} />;

  return <JobDetail job={job} />;
}
