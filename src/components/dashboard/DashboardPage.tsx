"use client";

import { MetricCards } from "@/components/dashboard/MetricCards";
import { ApprovalList } from "@/components/dashboard/ApprovalList";
import { QuickAccess } from "@/components/dashboard/QuickAccess";
import { useI18n } from "@/components/i18n/I18nProvider";
import { currentBrand } from "@/data/mock";

export function DashboardPage() {
  const { t } = useI18n();

  return (
    <div>
      <p className="text-sm text-luma-kahve">
        {t("dashboard.greeting", { brand: currentBrand.name })}
      </p>
      <h1 className="mt-0.5 text-[28px] font-bold tracking-tight text-foreground">
        {t("dashboard.title")}
      </h1>
      <div className="mt-4">
        <MetricCards />
      </div>
      <div className="mt-6 space-y-6">
        <ApprovalList />
        <QuickAccess />
      </div>
    </div>
  );
}
