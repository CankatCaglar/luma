import { CompletedJobsPage } from "@/components/jobs/CompletedJobsPage";
import { currentBrand } from "@/data/mock";
import { getJobLists } from "@/lib/data/jobs";

export const revalidate = 300;

export default async function TamamlananIslerRoute() {
  const { completedJobs, referenceNowIso } = await getJobLists();

  return (
    <CompletedJobsPage
      jobs={completedJobs}
      brand={currentBrand}
      referenceNowIso={referenceNowIso}
    />
  );
}
