"use client";

import { ChevronRight, FileText, ImageIcon, Info } from "lucide-react";
import { brandAssets } from "@/data/mock";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconTile } from "@/components/ui/IconTile";
import type { BrandAssetKind } from "@/types";

const icons: Record<BrandAssetKind, typeof ImageIcon> = {
  logo: ImageIcon,
  brief: FileText,
};

export default function MarkaPage() {
  const { t } = useI18n();

  return (
    <div>
      <PageHeader
        title={t("brandCenter.title")}
        subtitle={t("brandCenter.subtitle")}
      />
      <div className="space-y-3">
        {brandAssets.map((asset) => {
          const Icon = icons[asset.kind];
          return (
            <a
              key={asset.id}
              href={asset.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex select-none items-center gap-3 rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80 transition-transform duration-150 ease-out active:scale-[0.97]"
            >
              <IconTile tone={asset.kind === "brief" ? "gold" : "purple"}>
                <Icon className="h-5 w-5" strokeWidth={1.8} />
              </IconTile>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground">
                  {t(asset.nameKey)}
                </span>
                <span className="text-sm text-luma-muted">
                  {t(asset.descriptionKey)}
                </span>
              </span>
              <ChevronRight className="h-4 w-4 text-luma" />
            </a>
          );
        })}
      </div>
      <div className="mt-4 flex items-start gap-3 rounded-2xl bg-luma-soft px-4 py-3.5">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-luma" strokeWidth={2} />
        <p className="text-sm leading-relaxed text-luma">{t("brandCenter.info")}</p>
      </div>
    </div>
  );
}
