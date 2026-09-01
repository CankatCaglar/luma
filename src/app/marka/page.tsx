"use client";

import { BrandCenter } from "@/components/brand/BrandCenter";
import { useJobs } from "@/components/jobs/JobsProvider";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

export default function MarkaPage() {
  const { data, status } = useJobs();

  if (status === "loading" || !data) return <PageSkeleton cards={4} />;

  return <BrandCenter assets={data.brandAssets ?? []} />;
}
