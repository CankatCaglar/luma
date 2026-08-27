import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlanDetail } from "@/components/plans/PlanDetail";
import { getJobLists } from "@/lib/data/jobs";

export const metadata: Metadata = { title: "İçerik Planı" };
export const revalidate = 300;

export default async function PlanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { contentPlans } = await getJobLists();
  const plan = contentPlans.find((item) => item.id === id);
  if (!plan) notFound();
  return <PlanDetail plan={plan} />;
}
