import { JobListScreen } from "@/components/jobs/JobListScreen";
import { getJobLists } from "@/lib/data/jobs";

export const dynamic = "force-dynamic";

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
