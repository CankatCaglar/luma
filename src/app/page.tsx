import { DashboardPage } from "@/components/dashboard/DashboardPage";
import { getJobLists } from "@/lib/data/jobs";

export default async function Home() {
  const { metrics, approvalItems } = await getJobLists();

  return <DashboardPage metrics={metrics} approvalItems={approvalItems} />;
}
