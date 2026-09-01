"use client";

import { useParams } from "next/navigation";
import { PlanDetail } from "@/components/plans/PlanDetail";
import { MissingRecord } from "@/components/ui/MissingRecord";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useJobs } from "@/components/jobs/JobsProvider";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const { data } = useJobs();
  if (!data) return <PageSkeleton cards={2} />;
  const plan = data.contentPlans.find((item) => item.id === id);
  if (!plan) return <MissingRecord label={t("plans.missing")} />;
  return <PlanDetail plan={plan} />;
}
