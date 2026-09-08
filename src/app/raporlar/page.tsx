"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ReportsList } from "@/components/reports/ReportsList";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useJobs } from "@/components/jobs/JobsProvider";
import { hasDriveReports } from "@/lib/data/reports";

export default function RaporlarPage() {
  const { data, status } = useJobs();
  const router = useRouter();
  const reports = data?.monthlyReports ?? [];
  const available = hasDriveReports(reports);

  useEffect(() => {
    if (status === "loading" || !data) return;
    if (!available) router.replace("/");
  }, [available, data, router, status]);

  if (status === "loading" || !data || !available) return <PageSkeleton cards={4} />;
  return <ReportsList reports={reports} />;
}
