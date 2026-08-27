import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportDetail } from "@/components/reports/ReportDetail";
import { getJobLists } from "@/lib/data/jobs";

export const metadata: Metadata = { title: "Rapor" };
export const revalidate = 300;

export default async function ReportDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { monthlyReports } = await getJobLists();
  const report = monthlyReports.find((item) => item.id === id);
  if (!report) notFound();
  return <ReportDetail report={report} />;
}
