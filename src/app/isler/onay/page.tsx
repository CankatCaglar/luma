"use client";

import { JobListScreen } from "@/components/jobs/JobListScreen";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useJobs } from "@/components/jobs/JobsProvider";

export default function OnayIslerPage() {
  const { data, status } = useJobs();
  if (status === "loading" || !data) return <PageSkeleton cards={5} />;
  return (
    <JobListScreen
      jobs={data.pendingJobs}
      subtitleKey="jobs.pending.subtitle"
      dateKind="due"
    />
  );
}
