"use client";

import Link from "next/link";
import { Calendar, ChevronRight } from "lucide-react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TagList } from "@/components/ui/TagBadge";
import { IconTile } from "@/components/ui/IconTile";
import { useI18n } from "@/components/i18n/I18nProvider";
import { formatDueDate } from "@/lib/format";
import { resolveJobHref } from "@/lib/jobHref";
import { jobIcons, statusKeys } from "@/components/jobs/jobMeta";
import type { Job } from "@/types";
import type { MessageKey } from "@/i18n";

type DateKind = "delivery" | "due" | "completed";

const dateKeys: Record<DateKind, MessageKey> = {
  delivery: "jobs.delivery",
  due: "jobs.dueDate",
  completed: "jobs.completedDate",
};

export function JobList({
  jobs,
  emptyLabel,
  dateKind = "delivery",
}: {
  jobs: Job[];
  emptyLabel: string;
  dateKind?: DateKind;
}) {
  const { t, locale } = useI18n();

  if (jobs.length === 0) {
    return (
      <p className="rounded-2xl bg-luma-card px-4 py-8 text-center text-sm text-luma-muted ring-1 ring-luma-border/80">
        {emptyLabel}
      </p>
    );
  }

  return (
    <div className="space-y-2.5">
      {jobs.map((job) => {
        const Icon = jobIcons[job.kind];
        const dateValue =
          dateKind === "completed" && job.completedAt
            ? job.completedAt
            : job.dueDate;

        return (
          <Link
            key={job.id}
            href={resolveJobHref(job)}
            className="flex select-none items-center gap-3 rounded-2xl bg-luma-card p-3.5 ring-1 ring-luma-border/80 transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <IconTile className="h-12 w-12">
              <Icon className="h-5 w-5" strokeWidth={1.8} />
            </IconTile>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">{job.title}</p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <StatusBadge status={job.status} label={t(statusKeys[job.status])} />
                <TagList tags={job.tags} />
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-luma-muted">
                <Calendar className="h-3 w-3 text-luma" />
                {t(dateKeys[dateKind], {
                  date: formatDueDate(dateValue, locale),
                })}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-luma" />
          </Link>
        );
      })}
    </div>
  );
}
