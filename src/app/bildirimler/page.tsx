"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { PageSkeleton } from "@/components/ui/PageSkeleton";

function formatWhen(iso: string, locale: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function BildirimlerPage() {
  const { t, locale } = useI18n();
  const { items, loading, unread, markRead, markAllRead } = useNotifications();

  if (loading) return <PageSkeleton cards={5} />;

  return (
    <div>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold tracking-tight text-foreground">
            {t("notifications.title")}
          </h1>
          <p className="mt-1 max-w-[18rem] text-sm leading-relaxed text-luma-muted">
            {t("notifications.subtitle")}
          </p>
        </div>
        {unread > 0 ? (
          <button
            type="button"
            onClick={() => void markAllRead()}
            className="shrink-0 text-sm font-semibold text-luma"
          >
            {t("notifications.markAllRead")}
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="mt-16 flex flex-col items-center px-8 text-center">
          <Bell className="h-6 w-6 text-luma" strokeWidth={1.8} />
          <p className="mt-4 text-sm leading-relaxed text-luma-muted">
            {t("notifications.empty")}
          </p>
        </div>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={item.href || "/"}
                onClick={() => {
                  if (!item.read) void markRead(item.id);
                }}
                className={`block rounded-2xl p-4 ring-1 ring-luma-border/80 transition-transform duration-150 ease-out active:scale-[0.97] ${
                  item.read ? "bg-luma-card" : "bg-white"
                }`}
              >
                <div className="flex items-start gap-3">
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${
                      item.read ? "bg-transparent" : "bg-luma"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-foreground">{item.title}</p>
                    {item.body ? (
                      <p className="mt-1 truncate text-sm text-luma-muted">{item.body}</p>
                    ) : null}
                    <p className="mt-2 text-[11px] text-luma-muted">
                      {formatWhen(item.createdAt, locale)}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
