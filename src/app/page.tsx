"use client";

import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { DashboardSkeleton } from "@/components/ui/PageSkeleton";
import { useJobs } from "@/components/jobs/JobsProvider";

export default function Home() {
  const { data, status } = useJobs();
  if (status === "loading" || !data) return <DashboardSkeleton />;
  return (
    <DashboardPage metrics={data.metrics} approvalItems={data.approvalItems} />
  );
}
