"use client";

import { ExternalLink, Eye, Info } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TagList } from "@/components/ui/TagBadge";
import { jobIcons, jobKindKeys, statusKeys } from "@/components/jobs/jobMeta";
import { formatDueDate } from "@/lib/format";
import type { Job } from "@/types";

function sourceLabel(url: string | undefined) {
  if (!url) return "—";
  if (/presentation\/d\//i.test(url)) return "Google Slides";
  if (/document\/d\//i.test(url)) return "Google Docs";
  if (/docs\.google\.com/i.test(url)) return "Google Docs";
  if (/drive\.google\.com/i.test(url)) return "Google Drive";
  return "Google Drive";
}

function actionLabel(url: string | undefined) {
  if (!url) return null;
  if (/presentation\/d\//i.test(url)) return "Google Slides'ta Görüntüle";
  if (/document\/d\//i.test(url)) return "Google Docs'ta Görüntüle";
  return "Drive'da Görüntüle";
}

export function JobDetail({ job }: { job: Job }) {
  const { t, locale } = useI18n();
  const TitleIcon = jobIcons[job.kind];
  const openUrl = job.resourceUrl;
  const hasOpenUrl = Boolean(openUrl);
  const awaitingApproval = job.status === "pending_approval" || job.status === "review";
  const dateLabel = awaitingApproval
    ? t("jobs.deliveredForApproval", { date: formatDueDate(job.dueDate, locale) })
    : job.status === "completed"
      ? t("jobs.completedDate", {
          date: formatDueDate(job.completedAt ?? job.dueDate, locale),
        })
      : t("jobs.delivery", { date: formatDueDate(job.dueDate, locale) });

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80">
        <h1 className="flex items-start gap-2 text-lg font-bold leading-7 text-foreground">
          <TitleIcon className="mt-[5px] size-[1em] shrink-0 text-luma" strokeWidth={2} />
          <span className="min-w-0">{job.title}</span>
        </h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          <StatusBadge status={job.status} label={t(statusKeys[job.status])} />
          <TagList tags={job.tags} />
        </div>
        <p className="mt-2 text-xs text-luma-muted">{dateLabel}</p>
        <p className="mt-4 text-sm leading-relaxed text-luma-muted">
          {t("jobs.detail.description")}
        </p>
      </section>

      <section className="rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80">
        <h2 className="flex items-start gap-2 text-base font-bold leading-6 text-foreground">
          <Eye className="mt-[4px] size-[1em] shrink-0 text-luma" strokeWidth={2} />
          {t("jobs.detail.accessTitle")}
        </h2>
        <div className="mt-2 divide-y divide-luma-border rounded-xl border border-luma-border">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-luma-muted">{t("jobs.detail.documentType")}</span>
            <span className="text-sm font-semibold text-foreground">
              {t(jobKindKeys[job.kind])}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-luma-muted">{t("jobs.detail.accessLevel")}</span>
            <span className="text-sm font-semibold text-foreground">
              {hasOpenUrl ? t("jobs.detail.accessViewOnly") : t("jobs.detail.accessPending")}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-luma-muted">{t("jobs.detail.source")}</span>
            <span className="text-sm font-semibold text-foreground">
              {sourceLabel(openUrl)}
            </span>
          </div>
        </div>

        {openUrl ? (
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex w-full select-none items-center justify-center gap-2 rounded-xl bg-luma py-3 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <ExternalLink className="h-[1em] w-[1em]" strokeWidth={2} />
            {actionLabel(openUrl)}
          </a>
        ) : null}
      </section>

      <p className="flex items-start gap-2 px-0.5 py-1 text-sm leading-5 text-luma">
        <Info className="mt-[3px] size-3.5 shrink-0" strokeWidth={2} />
        <span>{t("jobs.detail.help")}</span>
      </p>
    </div>
  );
}
