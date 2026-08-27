"use client";

import { ReportsList } from "@/components/reports/ReportsList";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useJobs } from "@/components/jobs/JobsProvider";

export default function RaporlarPage() {
  const { data, status } = useJobs();
  if (status === "loading" || !data) return <PageSkeleton cards={4} />;
  return <ReportsList reports={data.monthlyReports} />;
}
