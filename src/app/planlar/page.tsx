import { PlansList } from "@/components/plans/PlansList";
import { getJobLists } from "@/lib/data/jobs";

export const revalidate = 300;

export default async function PlanlarPage() {
  const { contentPlans } = await getJobLists();
  return <PlansList plans={contentPlans} />;
}
