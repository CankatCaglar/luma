"use client";

import { Bell } from "lucide-react";
import { useI18n } from "@/components/i18n/I18nProvider";

export default function BildirimlerPage() {
  const { t } = useI18n();

  return (
    <div className="flex min-h-[calc(100dvh-13.5rem)] flex-col items-center justify-center px-8 text-center">
      <Bell className="h-6 w-6 text-luma" strokeWidth={1.8} />
      <h1 className="mt-4 text-lg font-bold tracking-tight text-foreground">
        {t("notifications.title")}
      </h1>
      <p className="mt-2 max-w-[16.5rem] text-sm leading-relaxed text-luma-muted">
        {t("notifications.comingSoon")}
      </p>
    </div>
  );
}
