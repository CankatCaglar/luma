"use client";

import { PlansList } from "@/components/plans/PlansList";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useJobs } from "@/components/jobs/JobsProvider";

export default function PlanlarPage() {
  const { data, status } = useJobs();
  if (status === "loading" || !data) return <PageSkeleton cards={4} />;
  return <PlansList
    plans={data.contentPlans}
    folderUrl={data.plansFolderUrl}
    folderTitle={data.plansFolderTitle}
    planYears={data.planYears}
  />;
}
