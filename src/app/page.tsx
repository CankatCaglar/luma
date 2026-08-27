import { Suspense } from "react";
import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { DashboardSkeleton } from "@/components/ui/PageSkeleton";
import { getJobLists } from "@/lib/data/jobs";

export const revalidate = 300;

async function HomeDashboard() {
  const { metrics, approvalItems } = await getJobLists();
  return <DashboardPage metrics={metrics} approvalItems={approvalItems} />;
}

export default function Home() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <HomeDashboard />
    </Suspense>
  );
}
