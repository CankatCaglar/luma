"use client";

import { useParams } from "next/navigation";
import { ReportDetail } from "@/components/reports/ReportDetail";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useJobs } from "@/components/jobs/JobsProvider";

export default function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, status } = useJobs();
  if (status === "loading" || !data) return <PageSkeleton cards={2} />;
  const report = data.monthlyReports.find((item) => item.id === id);
  if (!report) return <PageSkeleton cards={2} />;
  return <ReportDetail report={report} />;
}
