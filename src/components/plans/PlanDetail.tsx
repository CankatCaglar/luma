"use client";

import { Calendar, ExternalLink, FileSpreadsheet, Info } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { IconTile } from "@/components/ui/IconTile";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { statusKeys } from "@/components/jobs/jobMeta";
import { formatDueDate, formatMonth } from "@/lib/format";
import type { ContentPlan } from "@/types";

function planSourceLabel(url: string) {
  if (/presentation\/d\//i.test(url)) return "Google Slides";
  if (/document\/d\//i.test(url)) return "Google Docs";
  return "Google Drive";
}

function planActionLabel(url: string) {
  if (/presentation\/d\//i.test(url)) return "Google Slides'ta Görüntüle";
  if (/document\/d\//i.test(url)) return "Google Docs'ta Görüntüle";
  return "Drive'da Görüntüle";
}

export function PlanDetail({ plan }: { plan: ContentPlan }) {
  const { t, locale } = useI18n();
  const link = plan.slidesUrl;
  const hasLink = Boolean(link);
  const awaitingApproval = plan.status === "pending_approval" || plan.status === "review";
  const summaryDate = plan.dueDate
    ? formatDueDate(plan.dueDate, locale)
    : formatMonth(plan.month, locale);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80">
        <div className="flex items-start gap-3">
          <IconTile tone="gold">
            <FileSpreadsheet className="h-5 w-5" strokeWidth={1.8} />
          </IconTile>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-foreground">
              {formatMonth(plan.month, locale)}
            </h1>
            <p className="mt-0.5 text-sm text-luma-muted">{plan.title}</p>
            <div className="mt-2">
              <StatusBadge
                status={plan.status}
                label={t(statusKeys[plan.status])}
              />
            </div>
            {awaitingApproval ? (
              <p className="mt-2 flex items-start gap-1 text-xs text-luma-muted">
                <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-luma" />
                {t("jobs.deliveredForApproval", { date: summaryDate })}
              </p>
            ) : null}
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-luma-muted">
          {t("plans.detailDescription")}
        </p>
      </section>

      <section className="rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80">
        <h2 className="text-base font-bold text-foreground">{t("plans.accessTitle")}</h2>
        <div className="mt-2 divide-y divide-luma-border rounded-xl border border-luma-border">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-luma-muted">{t("plans.documentType")}</span>
            <span className="text-sm font-semibold text-foreground">
              {hasLink && link ? planSourceLabel(link) : "—"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-luma-muted">{t("plans.sharing")}</span>
            <span className="text-sm font-semibold text-foreground">
              {hasLink ? t("plans.viewOnly") : t("plans.linkPending")}
            </span>
          </div>
        </div>

        {link ? (
          <a
            href={link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full select-none items-center justify-center gap-2 rounded-xl bg-luma py-3 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
            {planActionLabel(link)}
          </a>
        ) : null}
      </section>

      <section className="rounded-2xl bg-luma-soft px-3.5 py-3 text-sm text-luma">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("plans.help")}</span>
        </p>
      </section>
    </div>
  );
}
