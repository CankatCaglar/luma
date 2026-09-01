"use client";

import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { useAuth } from "@/components/auth/AuthProvider";
import { useJobs } from "@/components/jobs/JobsProvider";

export default function Home() {
  const { data } = useJobs();
  const { brandName: claimedBrand } = useAuth();
  const brandName = data?.tenant.brandName || claimedBrand || "";

  return (
    <DashboardPage
      brandName={brandName}
      metrics={data?.metrics}
      approvalItems={data?.approvalItems}
      loading={!data}
      metricsPending={Boolean(data?.partial)}
    />
  );
}
