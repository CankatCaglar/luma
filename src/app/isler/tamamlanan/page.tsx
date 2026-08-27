"use client";

import { CompletedJobsPage } from "@/components/jobs/CompletedJobsPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useJobs } from "@/components/jobs/JobsProvider";
import { currentBrand } from "@/data/mock";

export default function TamamlananIslerRoute() {
  const { data, status } = useJobs();
  if (status === "loading" || !data) return <PageSkeleton cards={5} />;
  return (
    <CompletedJobsPage
      jobs={data.completedJobs}
      brand={currentBrand}
      referenceNowIso={data.referenceNowIso}
    />
  );
}
