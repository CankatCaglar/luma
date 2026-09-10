"use client";

import { useEffect, useId, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Loader2, X } from "lucide-react";

export function ConfirmDialog({
  open,
  busy = false,
  title,
  description,
  confirmLabel,
  cancelLabel = "Vazgeç",
  tone = "primary",
  icon,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  busy?: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  icon?: ReactNode;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const descId = useId();
  const isDanger = tone === "danger";

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) onCancel();
    }

    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, busy, onCancel]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div className="fixed inset-0 z-[1100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label={cancelLabel}
        className="absolute inset-0 bg-[#1c1917]/40 backdrop-blur-[2px]"
        disabled={busy}
        onClick={onCancel}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descId}
        className="relative w-full max-w-sm rounded-3xl bg-white px-5 py-6 shadow-[0_24px_64px_rgba(28,25,23,0.16)] ring-1 ring-luma-border/80"
      >
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-xl text-luma-muted transition-colors hover:bg-luma-soft hover:text-foreground disabled:opacity-60"
          aria-label={cancelLabel}
        >
          <X className="h-4 w-4" />
        </button>
        {icon ? (
          <div
            className={`mx-auto flex h-12 w-12 items-center justify-center rounded-2xl ${
              isDanger ? "bg-red-50 text-luma-red" : "bg-luma-soft text-luma"
            }`}
          >
            {icon}
          </div>
        ) : null}
        <h2
          id={titleId}
          className={`text-center text-xl font-bold tracking-tight text-foreground ${
            icon ? "mt-4" : "mt-2 pr-6"
          }`}
        >
          {title}
        </h2>
        <p id={descId} className="mt-2 text-center text-sm leading-relaxed text-luma-muted">
          {description}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl border border-luma-border px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-luma-soft disabled:cursor-not-allowed disabled:opacity-70"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            data-haptic={isDanger ? "warning" : "success"}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70 ${
              isDanger ? "bg-luma-red" : "bg-luma"
            }`}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
