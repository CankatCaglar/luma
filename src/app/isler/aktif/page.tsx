"use client";

import { JobListScreen } from "@/components/jobs/JobListScreen";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useJobs } from "@/components/jobs/JobsProvider";

export default function AktifIslerPage() {
  const { data, status } = useJobs();
  if (status === "loading" || !data) return <PageSkeleton cards={5} />;
  return (
    <JobListScreen
      jobs={data.activeJobs}
      subtitleKey="jobs.active.subtitle"
      dateKind="delivery"
    />
  );
}
