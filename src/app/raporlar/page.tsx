import { ReportsList } from "@/components/reports/ReportsList";
import { getJobLists } from "@/lib/data/jobs";

export default async function RaporlarPage() {
  const { monthlyReports } = await getJobLists();
  return <ReportsList reports={monthlyReports} />;
}
