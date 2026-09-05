"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronDown,
  Clock,
  File,
  FileArchive,
  FileImage,
  FileText,
  Loader2,
  Send,
  Upload,
  X,
  Zap,
} from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { cn } from "@/lib/cn";
import {
  ASANA_PRIORITY_LEVELS,
  REQUEST_CATEGORIES,
  subtypesFor,
  type AsanaPriorityLevel,
  type RequestCategory,
} from "@/lib/requests/catalog";
import { formatDueDate, formatFileSize } from "@/lib/format";
import {
  REQUEST_FILE_ACCEPT,
  REQUEST_FILE_MAX_COUNT,
  validateRequestFile,
} from "@/lib/requests/files";
import type { RequestPriority } from "@/types";
import type { MessageKey } from "@/i18n";

const BRIEF_MIN = 3;
const BRIEF_MAX = 1000;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function categoryKey(id: RequestCategory): MessageKey {
  return `request.categories.${id}`;
}

function subtypeKey(id: string): MessageKey {
  return `request.subtypes.${id}` as MessageKey;
}

let cachedTalepFiles: File[] = [];

function sameFile(left: File, right: File): boolean {
  return left.name === right.name && left.size === right.size && left.lastModified === right.lastModified;
}

export default function TalepPage() {
  const { t, locale } = useI18n();
  const { enabled, user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<RequestCategory | "">("");
  const [subtype, setSubtype] = useState("");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [priority, setPriority] = useState<RequestPriority>("standard");
  const [asanaPriority, setAsanaPriority] = useState<AsanaPriorityLevel>("medium");
  const [urgentReason, setUrgentReason] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [files, setFiles] = useState<File[]>(cachedTalepFiles);
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const subtypeOptions = category ? subtypesFor(category) : [];
  const needsSubtype = subtypeOptions.length > 0;

  useEffect(() => {
    if (priority === "urgent") setAsanaPriority("high");
  }, [priority]);

  function commitFiles(next: File[]) {
    cachedTalepFiles = next;
    setFiles(next);
  }

  function addFiles(incoming: FileList | File[] | null) {
    const picked = incoming ? Array.from(incoming) : [];
    if (picked.length === 0) return;

    const next = [...cachedTalepFiles];
    let nextError: string | null = null;
    for (const file of picked) {
      if (next.some((item) => sameFile(item, file))) continue;
      if (next.length >= REQUEST_FILE_MAX_COUNT) {
        nextError = t("request.fileTooMany");
        break;
      }
      const issue = validateRequestFile(file);
      if (issue === "size") {
        nextError = t("request.fileTooLarge", { name: file.name });
        continue;
      }
      next.push(file);
      if (issue === "type") {
        nextError = t("request.fileBadType", { name: file.name });
      }
    }
    setFileError(nextError);
    commitFiles(next);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const canSubmit = Boolean(
    category &&
      (!needsSubtype || subtype) &&
      title.trim().length >= 3 &&
      brief.trim().length >= BRIEF_MIN &&
      asanaPriority &&
      (priority === "standard" ||
        (urgentReason.trim().length >= 3 && dueDate)),
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!category || !canSubmit) return;
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      const headers: HeadersInit = {};
      if (enabled && user) {
        headers.Authorization = `Bearer ${await user.getIdToken()}`;
      }

      const form = new FormData();
      form.append(
        "payload",
        JSON.stringify({
          category,
          subtype: needsSubtype ? subtype : undefined,
          subject: title,
          brief,
          priority,
          asanaPriority,
          urgentReason: priority === "urgent" ? urgentReason : undefined,
          dueDate: priority === "urgent" ? dueDate : undefined,
        }),
      );
      for (const file of files) {
        form.append("files", file, file.name);
      }

      const response = await fetch("/api/requests", {
        method: "POST",
        headers,
        body: form,
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
      setCategory("");
      setSubtype("");
      setPriority("standard");
      setAsanaPriority("medium");
      setUrgentReason("");
      setDueDate("");
      commitFiles([]);
      setFileError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Talep gönderilemedi");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-w-0">
      <p className="mb-4 text-sm text-luma-kahve">{t("request.subtitle")}</p>
      <form className="min-w-0 space-y-4" onSubmit={handleSubmit}>
        <RequestSelect
          label={t("request.type")}
          required
          value={category}
          placeholder={t("request.typePlaceholder")}
          options={REQUEST_CATEGORIES.map((id) => ({
            id,
            label: t(categoryKey(id)),
          }))}
          onChange={(next) => {
            setCategory(next as RequestCategory);
            setSubtype("");
          }}
        />

        {needsSubtype ? (
          <RequestSelect
            label={t("request.subtype")}
            required
            value={subtype}
            placeholder={t("request.subtypePlaceholder")}
            options={subtypeOptions.map((id) => ({
              id,
              label: t(subtypeKey(id)),
            }))}
            onChange={setSubtype}
          />
        ) : null}

        <label className="block">
          <span className="text-sm font-medium text-foreground">
            {t("request.subject")} <span className="text-luma-red">*</span>
          </span>
          <input
            required
            type="text"
            maxLength={140}
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
              minLength={BRIEF_MIN}
              maxLength={BRIEF_MAX}
              rows={5}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
              placeholder={t("request.briefPlaceholder")}
              className="w-full resize-none rounded-xl border border-luma-border bg-white px-3 py-3 pb-8 text-base outline-none placeholder:text-luma-muted focus:ring-2 focus:ring-luma"
            />
            <span className="pointer-events-none absolute bottom-2.5 right-3 text-[11px] text-luma-muted">
              {brief.length} / {BRIEF_MAX}
            </span>
          </span>
          <span className="mt-1 block text-xs text-luma-muted">{t("request.briefHint")}</span>
        </label>

        <div>
          <p className="text-sm font-medium text-foreground">{t("request.file")}</p>
          <p className="mt-0.5 text-xs text-luma-muted">{t("request.fileHint")}</p>
          <label
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragging(false);
              addFiles(event.dataTransfer.files);
            }}
            className={cn(
              "relative mt-2 flex w-full cursor-pointer select-none flex-col items-center rounded-2xl border-2 border-dashed px-4 py-6 text-center transition-transform duration-150 ease-out active:scale-[0.97]",
              dragging ? "border-luma bg-luma-soft" : "border-luma/50 bg-luma-soft/70",
            )}
          >
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept={REQUEST_FILE_ACCEPT}
              className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              onChange={(event) => addFiles(event.target.files)}
              onInput={(event) => addFiles((event.target as HTMLInputElement).files)}
            />
            <Upload className="h-7 w-7 text-luma" strokeWidth={1.6} />
            <span className="mt-2 text-sm font-medium text-luma">{t("request.fileDrop")}</span>
            <span className="mt-1 text-[11px] text-luma-muted">{t("request.fileTypes")}</span>
          </label>
          {files.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {files.map((file, index) => (
                <li
                  key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                  className="flex min-w-0 items-center gap-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-luma-border"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-luma-soft text-luma">
                    <RequestFileIcon name={file.name} type={file.type} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-foreground">
                      {file.name || "Dosya"}
                    </span>
                    <span className="block text-[11px] text-luma-muted">
                      {formatFileSize(file.size) ?? "—"}
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      commitFiles(files.filter((_, itemIndex) => itemIndex !== index))
                    }
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold text-luma-red transition-colors hover:bg-red-50"
                  >
                    <X className="h-3.5 w-3.5" />
                    {t("request.fileRemove")}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {fileError ? (
            <p className="mt-2 text-xs font-semibold text-luma-red">{fileError}</p>
          ) : null}
        </div>

        <div>
          <p className="text-sm font-medium text-foreground">
            {t("request.priority")} <span className="text-luma-red">*</span>
          </p>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setPriority("standard");
                setUrgentReason("");
                setDueDate("");
              }}
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

        {priority === "urgent" ? (
          <div className="min-w-0 space-y-4 overflow-hidden rounded-2xl bg-red-50/70 p-3 ring-1 ring-luma-red/15">
            <label className="block min-w-0">
              <span className="text-sm font-medium text-foreground">
                {t("request.urgentReason")} <span className="text-luma-red">*</span>
              </span>
              <textarea
                required
                maxLength={240}
                rows={3}
                value={urgentReason}
                onChange={(event) => setUrgentReason(event.target.value)}
                placeholder={t("request.urgentReasonPlaceholder")}
                className="mt-1.5 w-full min-w-0 resize-none rounded-xl border border-luma-border bg-white px-3 py-3 text-base outline-none placeholder:text-luma-muted focus:ring-2 focus:ring-luma"
              />
            </label>
            <div className="min-w-0">
              <span className="text-sm font-medium text-foreground">
                {t("request.dueDate")} <span className="text-luma-red">*</span>
              </span>
              <label className="relative mt-1.5 block min-w-0 overflow-hidden rounded-xl border border-luma-border bg-white focus-within:ring-2 focus-within:ring-luma">
                <span
                  className={cn(
                    "pointer-events-none flex min-h-12 items-center justify-between gap-3 px-3 py-3 text-base",
                    dueDate ? "text-foreground" : "text-luma-muted",
                  )}
                >
                  <span className="min-w-0 truncate">
                    {dueDate ? formatDueDate(dueDate, locale) : t("request.dueDatePlaceholder")}
                  </span>
                  <Calendar className="h-4 w-4 shrink-0 text-luma" />
                </span>
                <input
                  required
                  type="date"
                  min={todayIso()}
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                  className="absolute inset-0 z-10 h-full w-full min-w-0 cursor-pointer opacity-[0.01]"
                />
              </label>
            </div>
          </div>
        ) : null}

        <div>
          <p className="text-sm font-medium text-foreground">
            {t("request.asanaPriority")} <span className="text-luma-red">*</span>
          </p>
          <p className="mt-0.5 text-xs text-luma-muted">{t("request.asanaPriorityHint")}</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ASANA_PRIORITY_LEVELS.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setAsanaPriority(level)}
                className={cn(
                  "flex select-none items-center justify-center rounded-xl border py-3 text-sm font-semibold transition-transform duration-150 ease-out active:scale-[0.97]",
                  asanaPriority === level
                    ? level === "high"
                      ? "border-[#f06a6a] bg-[#f06a6a]/12 text-[#c4473a]"
                      : level === "medium"
                        ? "border-[#f1bd6c] bg-[#f1bd6c]/18 text-[#945d3c]"
                        : "border-[#f8df72] bg-[#f8df72]/30 text-[#8a6d1b]"
                    : "border-luma-border bg-white text-luma-muted",
                )}
              >
                {t(
                  level === "high"
                    ? "request.asanaHigh"
                    : level === "medium"
                      ? "request.asanaMedium"
                      : "request.asanaLow",
                )}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={submitting || !canSubmit}
          className="flex w-full select-none items-center justify-center gap-2 rounded-xl bg-luma py-3.5 text-sm font-semibold text-white transition-transform duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
          {t("request.submit")}
        </button>
        {!canSubmit && !submitting ? (
          <p className="text-center text-xs text-luma-muted">{t("request.submitBlocked")}</p>
        ) : null}
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

function RequestFileIcon({ name, type }: { name: string; type: string }) {
  const lower = `${name} ${type}`.toLowerCase();
  if (lower.includes("pdf") || lower.includes("doc") || lower.includes("ppt") || lower.includes("xls")) {
    return <FileText className="h-4 w-4" />;
  }
  if (lower.includes("image") || /\.(jpe?g|png|webp)$/i.test(name)) {
    return <FileImage className="h-4 w-4" />;
  }
  if (lower.includes("zip")) {
    return <FileArchive className="h-4 w-4" />;
  }
  return <File className="h-4 w-4" />;
}

function RequestSelect({
  label,
  required,
  value,
  placeholder,
  options,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: string;
  placeholder: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const selected = useMemo(
    () => options.find((option) => option.id === value),
    [options, value],
  );

  useEffect(() => {
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  return (
    <div>
      <span className="text-sm font-medium text-foreground">
        {label}
        {required ? <span className="text-luma-red"> *</span> : null}
      </span>
      <div ref={rootRef} className="relative mt-1.5">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full select-none items-center justify-between rounded-xl border border-luma-border bg-white px-3 py-3 text-left text-sm outline-none transition-transform duration-150 ease-out active:scale-[0.97] focus:ring-2 focus:ring-luma"
        >
          <span className={cn("truncate", selected ? "text-foreground" : "text-luma-muted")}>
            {selected?.label ?? placeholder}
          </span>
          <ChevronDown
            className={cn("h-4 w-4 shrink-0 text-luma transition-transform", open && "rotate-180")}
          />
        </button>
        {open ? (
          <ul
            role="listbox"
            className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-luma-border bg-white py-1 shadow-lg"
          >
            {options.map((option) => (
              <li key={option.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={option.id === value}
                  onClick={() => {
                    onChange(option.id);
                    setOpen(false);
                  }}
                  className={cn(
                    "w-full px-3 py-3 text-left text-sm",
                    option.id === value
                      ? "bg-luma-soft font-semibold text-luma"
                      : "text-foreground",
                  )}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
