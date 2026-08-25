"use client";

import { ChevronRight, FileSpreadsheet } from "lucide-react";
import { contentPlans } from "@/data/mock";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconTile } from "@/components/ui/IconTile";

export default function PlanlarPage() {
  const { t } = useI18n();

  return (
    <div>
      <PageHeader title={t("plans.title")} subtitle={t("plans.subtitle")} />
      <div className="space-y-3">
        {contentPlans.map((plan) => (
          <article
            key={plan.id}
            className="flex select-none items-center gap-3 rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80 transition-transform duration-150 ease-out active:scale-[0.99]"
          >
            <IconTile tone="gold">
              <FileSpreadsheet className="h-5 w-5" strokeWidth={1.8} />
            </IconTile>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-semibold text-foreground">{plan.title}</h2>
                {plan.isCurrent ? (
                  <span className="rounded-full bg-luma-soft px-2 py-0.5 text-[10px] font-semibold text-luma">
                    {t("plans.current")}
                  </span>
                ) : null}
              </div>
            </div>
            <a
              href={plan.slidesUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex shrink-0 select-none items-center gap-0.5 text-sm font-semibold text-luma transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              {t("plans.view")}
              <ChevronRight className="h-4 w-4" />
            </a>
          </article>
        ))}
      </div>
    </div>
  );
}
