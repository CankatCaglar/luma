"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { JobDetail } from "@/components/jobs/JobDetail";
import { useJobs } from "@/components/jobs/JobsProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { MissingRecord } from "@/components/ui/MissingRecord";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { isInProgressWork } from "@/lib/workAccess";

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { data } = useJobs();
  const job = data?.jobs.find((item) => item.id === id);

  useEffect(() => {
    if (job && isInProgressWork(job.status)) {
      router.replace("/isler/aktif");
    }
  }, [job, router]);

  if (!data) return <PageSkeleton cards={3} />;
  if (!job) return <MissingRecord label={t("jobs.detail.missing")} />;
  if (isInProgressWork(job.status)) return <PageSkeleton cards={3} />;

  return <JobDetail job={job} />;
}
