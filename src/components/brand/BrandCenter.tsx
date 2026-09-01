"use client";

import { useState } from "react";
import { Download, Eye, Folder, Info, Loader2 } from "lucide-react";
import { useAuth } from "@/components/auth/AuthProvider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { IconTile } from "@/components/ui/IconTile";
import { downloadBrandFile } from "@/lib/downloadFile";
import { formatFileSize, formatUpdatedDate } from "@/lib/format";
import type { Locale } from "@/i18n";
import type { BrandAsset, BrandFile } from "@/types";

function fileKindLabel(file: BrandFile): string {
  const ext = file.name.split(".").pop();
  if (ext && ext.length <= 4 && ext !== file.name) return ext.toUpperCase();
  if (file.mimeType.includes("pdf")) return "PDF";
  if (file.mimeType.includes("svg") || file.mimeType.includes("svg+xml")) return "SVG";
  if (file.mimeType.includes("png")) return "PNG";
  if (file.mimeType.includes("presentation")) return "SLIDES";
  if (file.mimeType.includes("document")) return "DOC";
  return "FILE";
}

function fileMeta(
  file: BrandFile,
  locale: Locale,
  updatedLabel: (date: string) => string,
): string {
  const parts: string[] = [];
  const size = formatFileSize(file.size);
  if (size) parts.push(size);
  if (file.width && file.height) parts.push(`${file.width}x${file.height} px`);
  const updated = formatUpdatedDate(file.modifiedTime, locale);
  if (updated && !file.width) parts.push(updatedLabel(updated));
  return parts.join(" • ");
}

function FileRow({
  file,
  action,
}: {
  file: BrandFile;
  action: "download" | "view";
}) {
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const meta = fileMeta(file, locale, (date) => t("brandCenter.updated", { date }));
  const showDownload = action === "download";

  async function handleDownload() {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    try {
      const token = user ? await user.getIdToken() : null;
      await downloadBrandFile({
        fileId: file.id,
        fileName: file.name,
        mimeType: file.mimeType,
        token,
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[14px] bg-luma-gold-soft text-[11px] font-bold text-luma-kahve">
        {fileKindLabel(file)}
      </span>
      <a
        href={file.viewUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="min-w-0 flex-1 select-none"
      >
        <span className="block truncate font-semibold text-foreground">{file.name}</span>
        {meta ? <span className="block text-sm text-luma-muted">{meta}</span> : null}
        {failed ? (
          <span className="mt-0.5 block text-xs text-luma-red">{t("brandCenter.downloadFailed")}</span>
        ) : null}
      </a>
      {showDownload ? (
        <button
          type="button"
          onClick={() => void handleDownload()}
          disabled={busy}
          aria-label={busy ? t("brandCenter.downloading") : t("brandCenter.download")}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-luma transition-transform duration-150 ease-out active:scale-95 disabled:opacity-60"
        >
          {busy ? (
            <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.8} />
          ) : (
            <Download className="h-5 w-5" strokeWidth={1.8} />
          )}
        </button>
      ) : (
        <a
          href={file.viewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 select-none items-center gap-1 text-sm font-semibold text-luma"
        >
          <Eye className="h-4 w-4" strokeWidth={1.8} />
          {t("brandCenter.view")}
        </a>
      )}
    </div>
  );
}

function FolderRow({ url, label }: { url: string; label: string }) {
  const { t } = useI18n();
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex select-none items-center gap-3 px-4 py-3"
    >
      <IconTile tone="gold">
        <Folder className="h-5 w-5" strokeWidth={1.8} />
      </IconTile>
      <span className="min-w-0 flex-1 font-semibold text-foreground">{label}</span>
      <span className="inline-flex shrink-0 items-center gap-1 text-sm font-semibold text-luma">
        <Eye className="h-4 w-4" strokeWidth={1.8} />
        {t("brandCenter.view")}
      </span>
    </a>
  );
}

function AssetSection({
  asset,
  action,
}: {
  asset: BrandAsset;
  action: "download" | "view";
}) {
  const { t } = useI18n();
  const files = asset.files ?? [];

  return (
    <section>
      <div className="mb-2 px-0.5">
        <h2 className="font-semibold text-foreground">{t(asset.nameKey)}</h2>
        <p className="text-sm leading-relaxed text-luma-muted">{t(asset.descriptionKey)}</p>
      </div>
      <div className="divide-y divide-luma-border overflow-hidden rounded-2xl bg-luma-card ring-1 ring-luma-border/80">
        {files.length ? (
          files.map((file) => <FileRow key={file.id} file={file} action={action} />)
        ) : (
          <FolderRow url={asset.url} label={t(asset.nameKey)} />
        )}
      </div>
    </section>
  );
}

export function BrandCenter({ assets }: { assets: BrandAsset[] }) {
  const { t } = useI18n();
  const logo = assets.find((asset) => asset.kind === "logo");
  const brief = assets.find((asset) => asset.kind === "brief");
  const competitor = assets.find((asset) => asset.kind === "competitor");
  const box = assets.find((asset) => asset.kind === "box");

  if (!assets.length) {
    return (
      <div>
        <p className="mb-4 text-sm text-luma-kahve">{t("brandCenter.subtitle")}</p>
        <p className="rounded-2xl bg-luma-card px-4 py-8 text-center text-sm text-luma-muted ring-1 ring-luma-border/80">
          {t("brandCenter.empty")}
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-4 text-sm text-luma-kahve">{t("brandCenter.subtitle")}</p>
      <div className="space-y-6">
        {logo ? <AssetSection asset={logo} action="download" /> : null}
        {brief ? <AssetSection asset={brief} action="view" /> : null}
        {competitor ? <AssetSection asset={competitor} action="view" /> : null}
        {box ? <AssetSection asset={box} action="view" /> : null}
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-luma-soft px-4 py-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-luma" strokeWidth={2} />
        <p className="text-sm leading-relaxed text-luma">{t("brandCenter.info")}</p>
      </div>
    </div>
  );
}
