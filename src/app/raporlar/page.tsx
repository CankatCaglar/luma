import { ReportsList } from "@/components/reports/ReportsList";
import { getJobLists } from "@/lib/data/jobs";

export const dynamic = "force-dynamic";

export default async function RaporlarPage() {
  const { monthlyReports } = await getJobLists();
  return <ReportsList reports={monthlyReports} />;
}
