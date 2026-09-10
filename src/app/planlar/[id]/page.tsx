"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { PlanDetail } from "@/components/plans/PlanDetail";
import { MissingRecord } from "@/components/ui/MissingRecord";
import { PageSkeleton } from "@/components/ui/PageSkeleton";
import { useJobs } from "@/components/jobs/JobsProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { isInProgressWork } from "@/lib/workAccess";

export default function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const { data } = useJobs();
  const plan = data?.contentPlans.find((item) => item.id === id);

  useEffect(() => {
    if (plan && isInProgressWork(plan.status)) {
      router.replace("/planlar");
    }
  }, [plan, router]);

  if (!data) return <PageSkeleton cards={2} />;
  if (!plan) return <MissingRecord label={t("plans.missing")} />;
  if (isInProgressWork(plan.status)) return <PageSkeleton cards={2} />;

  return <PlanDetail plan={plan} />;
}
