"use client";

import { Calendar, ExternalLink, Info } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { IconTile } from "@/components/ui/IconTile";
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
  const Icon = jobIcons[job.kind];
  const openUrl = job.resourceUrl;
  const hasOpenUrl = Boolean(openUrl);

  return (
    <div className="space-y-4">
      <section className="rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80">
        <div className="flex items-start gap-3">
          <IconTile className="h-14 w-14">
            <Icon className="h-6 w-6" strokeWidth={1.9} />
          </IconTile>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-bold text-foreground">{job.title}</h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <StatusBadge status={job.status} label={t(statusKeys[job.status])} />
              <TagList tags={job.tags} />
            </div>
            <p className="mt-2 flex items-center gap-1 text-xs text-luma-muted">
              <Calendar className="h-3.5 w-3.5 text-luma" />
              {t("jobs.dueDate", { date: formatDueDate(job.dueDate, locale) })}
            </p>
          </div>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-luma-muted">
          {t("jobs.detail.description")}
        </p>
      </section>

      <section className="rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80">
        <h2 className="text-base font-bold text-foreground">{t("jobs.detail.accessTitle")}</h2>
        <div className="mt-2 divide-y divide-luma-border rounded-xl border border-luma-border">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-luma-muted">{t("jobs.detail.documentType")}</span>
            <span className="text-sm font-semibold text-foreground">
              {t(jobKindKeys[job.kind])}
            </span>
          </div>
          <div className="flex items-center justify-between gap-3 px-3 py-2.5">
            <span className="text-sm text-luma-muted">{t("jobs.detail.lastUpdate")}</span>
            <span className="text-sm font-semibold text-foreground">
              {formatDueDate(job.completedAt ?? job.dueDate, locale)}
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
            <ExternalLink className="h-4 w-4" strokeWidth={1.8} />
            {actionLabel(openUrl)}
          </a>
        ) : null}
      </section>

      <section className="rounded-2xl bg-luma-soft px-3.5 py-3 text-sm text-luma">
        <p className="flex items-start gap-2">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t("jobs.detail.help")}</span>
        </p>
      </section>
    </div>
  );
}
