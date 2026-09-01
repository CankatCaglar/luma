"use client";

import { useParams } from "next/navigation";
import { ReportDetail } from "@/components/reports/ReportDetail";
import { MissingRecord } from "@/components/ui/MissingRecord";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useJobs } from "@/components/jobs/JobsProvider";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { data } = useJobs();
  if (!data) return <PageSkeleton cards={2} />;
  const report = data.monthlyReports.find((item) => item.id === id);
  if (!report) return <MissingRecord label={t("reports.missing")} />;
  return <ReportDetail report={report} />;
}
