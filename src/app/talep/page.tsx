"use client";

import { useEffect, useRef, useState } from "react";
import {
  ChevronDown,
  Clock,
  Loader2,
  Send,
  Upload,
  Zap,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";
import type { RequestPriority, RequestType } from "@/types";
import type { MessageKey } from "@/i18n";

const typeOptions: { id: RequestType; key: MessageKey }[] = [
  { id: "video", key: "request.types.video" },
  { id: "design", key: "request.types.design" },
  { id: "content", key: "request.types.content" },
  { id: "ads", key: "request.types.ads" },
  { id: "other", key: "request.types.other" },
];

export default function TalepPage() {
  const { t } = useI18n();
  const { enabled, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<RequestType | "">("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("standard");
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [typeOpen, setTypeOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const typeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!typeRef.current?.contains(event.target as Node)) setTypeOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  function onFiles(files: FileList | null) {
    const file = files?.[0];
    if (file) setFileName(file.name);
  }

  const selectedType = typeOptions.find((option) => option.id === type);
  const canSubmit = Boolean(type && title.trim().length >= 3 && brief.trim().length >= 10);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!type) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (enabled && user) {
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
      }

      const response = await fetch("/api/requests", {
        method: "POST",
        headers,
        body: JSON.stringify({
          type,
          subject: title,
          brief,
          priority,
          fileName,
        }),
      });

      const payload = (await response.json().catch(() => null)) as
        | { error?: string; taskGid?: string }
        | null;
      if (!response.ok) {
        throw new Error(payload?.error ?? "Talep oluşturulamadı");
      }

      setSuccess("Talebiniz başarıyla iletildi.");
      setTitle("");
      setBrief("");
      setType("");
      setPriority("standard");
      setFileName(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Talep gönderilemedi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <p className="mb-4 text-sm text-luma-kahve">{t("request.subtitle")}</p>
      <form
        className="space-y-4"
        onSubmit={handleSubmit}
      >
        <div>
          <span className="text-sm font-medium text-foreground">
            {t("request.type")} <span className="text-luma-red">*</span>
          </span>
          <div ref={typeRef} className="relative mt-1.5">
            <button
              type="button"
              aria-haspopup="listbox"
              aria-expanded={typeOpen}
              onClick={() => setTypeOpen((open) => !open)}
              className="flex w-full select-none items-center justify-between rounded-xl border border-luma-border bg-white px-3 py-3 text-left text-sm outline-none transition-transform duration-150 ease-out active:scale-[0.97] focus:ring-2 focus:ring-luma"
            >
              <span
                className={cn(
                  "truncate",
                  selectedType ? "text-foreground" : "text-luma-muted",
                )}
              >
                {selectedType
                  ? t(selectedType.key)
                  : t("request.typePlaceholder")}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-luma transition-transform",
                  typeOpen && "rotate-180",
                )}
              />
            </button>
            {typeOpen ? (
              <ul
                role="listbox"
                className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-luma-border bg-white py-1 shadow-lg"
              >
                {typeOptions.map((option) => (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={option.id === type}
                      onClick={() => {
                        setType(option.id);
                        setTypeOpen(false);
                      }}
                      className={cn(
                        "w-full px-3 py-3 text-left text-sm",
                        option.id === type
                          ? "bg-luma-soft font-semibold text-luma"
                          : "text-foreground",
                      )}
                    >
                      {t(option.key)}
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </div>

        <label className="block">
          <span className="text-sm font-medium text-foreground">
            {t("request.subject")} <span className="text-luma-red">*</span>
          </span>
          <input
            required
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("request.subjectPlaceholder")}
            className="mt-1.5 w-full rounded-xl border border-luma-border bg-white px-3 py-3 text-base outline-none placeholder:text-luma-muted focus:ring-2 focus:ring-luma"
          />
        </label>

        <label className="block">
          <span className="text-sm font-medium text-foreground">
            {t("request.brief")} <span className="text-luma-red">*</span>
          </span>
          <span className="relative mt-1.5 block">
            <textarea
              required
              maxLength={1000}
              rows={5}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder={t("request.briefPlaceholder")}
              className="w-full resize-none rounded-xl border border-luma-border bg-white px-3 py-3 pb-8 text-base outline-none placeholder:text-luma-muted focus:ring-2 focus:ring-luma"
            />
            <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] text-luma-muted">
              {brief.length} / 1000
            </span>
          </span>
        </label>

        <div>
          <p className="text-sm font-medium text-foreground">{t("request.file")}</p>
          <p className="mt-0.5 text-xs text-luma-muted">{t("request.fileHint")}</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,.zip"
            className="hidden"
            onChange={(event) => onFiles(event.target.files)}
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              onFiles(event.dataTransfer.files);
            }}
            className={cn(
              "mt-2 flex w-full select-none flex-col items-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-transform duration-150 ease-out active:scale-[0.97]",
              dragging
                ? "border-luma bg-luma-soft"
                : "border-luma/50 bg-luma-soft/70",
            )}
          >
            <Upload className="h-7 w-7 text-luma" strokeWidth={1.6} />
            <span className="mt-2 text-sm font-medium text-luma">
              {fileName ?? t("request.fileDrop")}
            </span>
            <span className="mt-1 text-[11px] text-luma-muted">
              {t("request.fileTypes")}
            </span>
          </button>
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">
            {t("request.priority")} <span className="text-luma-red">*</span>
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPriority("standard")}
              className={cn(
                "flex select-none items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-transform duration-150 ease-out active:scale-[0.97]",
                priority === "standard"
                  ? "border-luma-gold bg-luma-gold-soft text-luma-kahve"
                  : "border-luma-border bg-white text-luma-muted",
              )}
            >
              <Clock className="h-4 w-4" />
              {t("request.standard")}
            </button>
            <button
              type="button"
              onClick={() => setPriority("urgent")}
              className={cn(
                "flex select-none items-center justify-center gap-2 rounded-xl border py-3 text-sm font-semibold transition-transform duration-150 ease-out active:scale-[0.97]",
                priority === "urgent"
                  ? "border-luma-red bg-red-50 text-luma-red"
                  : "border-luma-border bg-white text-luma-muted",
              )}
            >
              <Zap className="h-4 w-4 text-luma-red" />
              {t("request.urgent")}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="flex w-full select-none items-center justify-center gap-2 rounded-xl bg-luma py-3.5 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {t("request.submit")}
        </button>
        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-semibold text-luma-red">
            {error}
          </p>
        ) : null}
        {success ? (
          <p className="rounded-xl bg-luma-soft px-3 py-2 text-sm font-semibold text-luma">
            {success}
          </p>
        ) : null}
      </form>
    </div>
  );
}
