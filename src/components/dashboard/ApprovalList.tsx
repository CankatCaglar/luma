"use client";

import Link from "next/link";
import { Calendar, ChevronRight, FileText } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { TagList } from "@/components/ui/TagBadge";
import { formatDueDate } from "@/lib/format";
import { resolveJobHref } from "@/lib/jobHref";
import type { ApprovalItem } from "@/types";

export function ApprovalList({
  items,
  loading = false,
}: {
  items: ApprovalItem[];
  loading?: boolean;
}) {
  const { t, locale } = useI18n();
  const visible = items.slice(0, 2);

  return (
    <section>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-base font-bold text-foreground">
          {t("dashboard.approvals.title")}
        </h2>
        <Link
          href="/isler/onay"
          className="shrink-0 select-none whitespace-nowrap text-sm font-semibold text-luma transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          {t("dashboard.approvals.seeAll")}
        </Link>
      </div>
      <div className="space-y-2.5">
        {loading
          ? [0, 1].map((index) => (
              <div
                key={index}
                className="h-[4.75rem] animate-pulse rounded-2xl bg-luma-card ring-1 ring-luma-border/80"
              />
            ))
          : items.length === 0
            ? (
                <p className="rounded-2xl bg-luma-card px-4 py-8 text-center text-sm text-luma-muted ring-1 ring-luma-border/80">
                  {t("jobs.empty")}
                </p>
              )
            : visible.map((item) => (
          <Link
            key={item.id}
            href={resolveJobHref(item)}
            className="flex select-none items-center gap-3 rounded-2xl bg-luma-card p-3 ring-1 ring-luma-border/80 transition-transform duration-150 ease-out active:scale-[0.97]"
          >
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-luma-soft">
              <FileText className="h-6 w-6 text-luma" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold text-foreground">
                {item.title}
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <StatusBadge
                  status={item.status}
                  label={
                    item.status === "pending_approval"
                      ? t("dashboard.approvals.badgePending")
                      : t("dashboard.approvals.badgeReview")
                  }
                />
                <TagList tags={item.tags} />
              </div>
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-luma-muted">
                <Calendar className="h-3 w-3 text-luma" />
                {t("dashboard.approvals.dueDate", {
                  date: formatDueDate(item.dueDate, locale),
                })}
              </p>
            </div>
            <ChevronRight className="h-4 w-4 shrink-0 text-luma" />
          </Link>
        ))}
      </div>
    </section>
  );
}
