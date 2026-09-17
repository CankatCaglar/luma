"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Bell, Info, Trash2 } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useNotifications } from "@/components/notifications/NotificationsProvider";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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

function TitleHint({
  text,
  label,
  title,
  action,
}: {
  text: string;
  label: string;
  title: string;
  action?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: PointerEvent) {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <div className="flex items-center justify-between gap-3">
        <h1 className="flex min-w-0 items-center text-lg font-bold tracking-tight text-foreground">
          {title}
          <button
            type="button"
            aria-label={label}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
            className="ml-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-luma-muted/80 transition-colors hover:text-luma"
          >
            <Info className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </h1>
        {action}
      </div>
      {open ? (
        <p
          role="tooltip"
          className="absolute left-0 top-full z-20 mt-1 w-fit max-w-full rounded-xl bg-[#1c1917] px-3 py-2 text-left text-[11px] font-normal leading-relaxed text-white shadow-[0_12px_32px_rgba(28,25,23,0.24)]"
        >
          {text}
        </p>
      ) : null}
    </div>
  );
}

export default function BildirimlerPage() {
  const { t, locale } = useI18n();
  const { items, loading, unread, markRead, markAllRead, remove } = useNotifications();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDelete() {
    if (!pendingId || deleting) return;
    setDeleting(true);
    try {
      await remove(pendingId);
      setPendingId(null);
    } finally {
      setDeleting(false);
    }
  }

  if (loading) return <PageSkeleton cards={5} />;

  return (
    <div>
      <TitleHint
        title={t("notifications.title")}
        text={t("notifications.subtitle")}
        label={t("notifications.hint")}
        action={
          unread > 0 ? (
            <button
              type="button"
              onClick={() => void markAllRead()}
              className="shrink-0 text-sm font-semibold text-luma"
            >
              {t("notifications.markAllRead")}
            </button>
          ) : null
        }
      />

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
              <div
                className={`flex items-start gap-1 rounded-2xl ring-1 ring-luma-border/80 ${
                  item.read ? "bg-luma-card" : "bg-white"
                }`}
              >
                <Link
                  href={item.href || "/"}
                  onClick={() => {
                    if (!item.read) void markRead(item.id);
                  }}
                  className="min-w-0 flex-1 p-4 transition-transform duration-150 ease-out active:scale-[0.99]"
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
                <button
                  type="button"
                  aria-label={t("notifications.delete")}
                  onClick={() => setPendingId(item.id)}
                  className="mr-2 mt-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-luma-muted transition-colors hover:bg-white hover:text-[#9a3412]"
                >
                  <Trash2 className="h-4 w-4" strokeWidth={1.8} />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={Boolean(pendingId)}
        busy={deleting}
        tone="danger"
        icon={<Trash2 className="h-5 w-5" />}
        title={t("notifications.deleteConfirmTitle")}
        description={t("notifications.deleteConfirmDescription")}
        confirmLabel={t("notifications.delete")}
        cancelLabel={t("notifications.cancel")}
        onCancel={() => {
          if (!deleting) setPendingId(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
