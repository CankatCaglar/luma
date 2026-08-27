import { JobListScreen } from "@/components/jobs/JobListScreen";
import { getJobLists } from "@/lib/data/jobs";

export default async function AktifIslerPage() {
  const { activeJobs } = await getJobLists();

  return (
    <JobListScreen
      jobs={activeJobs}
      subtitleKey="jobs.active.subtitle"
      dateKind="delivery"
    />
  );
}
