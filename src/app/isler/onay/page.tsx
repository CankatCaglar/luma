import { JobListScreen } from "@/components/jobs/JobListScreen";
import { getJobLists } from "@/lib/data/jobs";

export default async function OnayIslerPage() {
  const { pendingJobs } = await getJobLists();

  return (
    <JobListScreen
      jobs={pendingJobs}
      subtitleKey="jobs.pending.subtitle"
      dateKind="due"
    />
  );
}
