"use client";

import { useParams } from "next/navigation";
import { PlanDetail } from "@/components/plans/PlanDetail";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useJobs } from "@/components/jobs/JobsProvider";

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, status } = useJobs();
  if (status === "loading" || !data) return <PageSkeleton cards={2} />;
  const plan = data.contentPlans.find((item) => item.id === id);
  if (!plan) return <PageSkeleton cards={2} />;
  return <PlanDetail plan={plan} />;
}
