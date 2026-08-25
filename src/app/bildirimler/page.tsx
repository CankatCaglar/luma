"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Pencil,
} from "lucide-react";
import { notifications } from "@/data/mock";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconTile } from "@/components/ui/IconTile";
import { formatRelativeTime } from "@/lib/format";
import type { NotificationCategory } from "@/types";

const categoryUi: Record<
  NotificationCategory,
  { icon: typeof Calendar; tone: "purple" | "gold" | "green" | "blue" }
> = {
  plan: { icon: Calendar, tone: "purple" },
  report: { icon: BarChart3, tone: "green" },
  approval: { icon: Clock, tone: "gold" },
  revision: { icon: Pencil, tone: "gold" },
  request: { icon: CheckCircle2, tone: "blue" },
  status: { icon: ArrowLeftRight, tone: "green" },
};

export default function BildirimlerPage() {
  const { t, locale } = useI18n();

  return (
    <div>
      <PageHeader
        title={t("notifications.title")}
        subtitle={t("notifications.subtitle")}
      />
      <div className="space-y-2.5">
        {notifications.length === 0 ? (
          <p className="rounded-2xl bg-luma-card px-4 py-8 text-center text-sm text-luma-muted ring-1 ring-luma-border/80">
            {t("notifications.empty")}
          </p>
        ) : (
          notifications.map((item) => {
            const ui = categoryUi[item.category];
            const Icon = ui.icon;
            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex select-none items-start gap-3 rounded-2xl bg-luma-card p-3.5 ring-1 ring-luma-border/80 transition-transform duration-150 ease-out active:scale-[0.97]"
              >
                <IconTile tone={ui.tone} className="mt-0.5">
                  <Icon className="h-5 w-5" strokeWidth={1.8} />
                </IconTile>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">
                    {item.title}
                  </span>
                  <span className="mt-0.5 block text-sm text-luma-muted">
                    {item.body}
                  </span>
                  <span className="mt-1.5 block text-[11px] text-luma-muted/80">
                    {formatRelativeTime(item.createdAt, locale)}
                  </span>
                </span>
                <span className="mt-1 flex shrink-0 items-center gap-2">
                  {!item.read ? (
                    <span className="h-2 w-2 rounded-full bg-luma" />
                  ) : null}
                  <ChevronRight className="h-4 w-4 text-luma-muted" />
                </span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
