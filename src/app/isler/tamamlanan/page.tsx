"use client";

import { CompletedJobsPage } from "@/components/jobs/CompletedJobsPage";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useJobs } from "@/components/jobs/JobsProvider";

export default function TamamlananIslerRoute() {
  const { data, status } = useJobs();
  if (status === "loading" || !data) return <PageSkeleton cards={5} />;
  return (
    <CompletedJobsPage
      jobs={data.completedJobs}
      brand={{ id: data.tenant.tenantId, name: data.tenant.brandName }}
      referenceNowIso={data.referenceNowIso}
    />
  );
}
