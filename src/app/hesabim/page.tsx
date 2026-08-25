"use client";

import type { ReactNode } from "react";
import {
  Bell,
  ChevronRight,
  Languages,
  LogOut,
  Mail,
  Phone,
  Shield,
  Store,
  User,
} from "lucide-react";
import { currentBrand, currentUser } from "@/data/mock";
import { useI18n } from "@/components/i18n/I18nProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconTile } from "@/components/ui/IconTile";
import { cn } from "@/lib/cn";
import type { Locale } from "@/i18n";

function Row({
  icon,
  tone,
  title,
  titleClass,
  subtitle,
  subtitleClass,
  trailing,
}: {
  icon: typeof User;
  tone?: "purple" | "gold" | "red";
  title: string;
  titleClass?: string;
  subtitle?: string;
  subtitleClass?: string;
  trailing?: ReactNode;
}) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <IconTile tone={tone} className="h-10 w-10 rounded-[12px]">
        <Icon className="h-4 w-4" strokeWidth={1.8} />
      </IconTile>
      <div className="min-w-0 flex-1">
        <p className={cn("text-sm font-semibold text-foreground", titleClass)}>
          {title}
        </p>
        {subtitle ? (
          <p className={cn("mt-0.5 text-sm text-luma-muted", subtitleClass)}>
            {subtitle}
          </p>
        ) : null}
      </div>
      {trailing ?? <ChevronRight className="h-4 w-4 text-luma" />}
    </div>
  );
}

export default function HesabimPage() {
  const { t, locale, setLocale } = useI18n();

  const languages: { id: Locale; label: string }[] =
    locale === "tr"
      ? [
          { id: "tr", label: "Türkçe" },
          { id: "en", label: "İngilizce" },
        ]
      : [
          { id: "tr", label: "Turkish" },
          { id: "en", label: "English" },
        ];

  return (
    <div>
      <PageHeader title={t("account.title")} />

      <p className="mb-2 text-xs font-semibold tracking-wide text-luma-muted">
        {t("account.userInfo")}
      </p>
      <section className="divide-y divide-luma-border overflow-hidden rounded-2xl bg-luma-card ring-1 ring-luma-border/80">
        <Row icon={User} title={t("account.name")} subtitle={currentUser.name} />
        <Row icon={Mail} title={t("account.email")} subtitle={currentUser.email} />
        <Row icon={Phone} title={t("account.phone")} subtitle={currentUser.phone} />
      </section>

      <p className="mb-2 mt-5 text-xs font-semibold tracking-wide text-luma-muted">
        {t("account.accountBrand")}
      </p>
      <section className="overflow-hidden rounded-2xl bg-luma-card ring-1 ring-luma-border/80">
        <Row
          icon={Store}
          tone="gold"
          title={t("account.activeBrand")}
          subtitle={currentBrand.name}
          subtitleClass="font-semibold text-luma-gold"
        />
      </section>

      <p className="mb-2 mt-5 text-xs font-semibold tracking-wide text-luma-muted">
        {t("account.settings")}
      </p>
      <section className="divide-y divide-luma-border overflow-hidden rounded-2xl bg-luma-card ring-1 ring-luma-border/80">
        <Row
          icon={Bell}
          title={t("account.notificationPrefs")}
          subtitle={t("account.notificationPrefsSub")}
        />
        <Row
          icon={Shield}
          title={t("account.password")}
          subtitle={t("account.passwordSub")}
        />
      </section>

      <section className="mt-3 rounded-2xl bg-luma-card ring-1 ring-luma-border/80">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <IconTile className="h-10 w-10 rounded-[12px]">
            <Languages className="h-4 w-4" strokeWidth={1.8} />
          </IconTile>
          <p className="min-w-0 flex-1 text-sm font-semibold text-foreground">
            {t("account.language")}
          </p>
          <div className="flex shrink-0 gap-1.5">
            {languages.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setLocale(item.id)}
                className={cn(
                  "select-none rounded-xl px-3 py-2 text-xs font-semibold transition-transform duration-150 ease-out active:scale-[0.97]",
                  locale === item.id
                    ? "bg-luma text-white"
                    : "bg-luma-soft text-luma",
                )}
                aria-pressed={locale === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl bg-luma-card ring-1 ring-luma-border/80">
        <button
          type="button"
          className="w-full select-none text-left transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          <Row
            icon={LogOut}
            tone="red"
            title={t("account.logout")}
            titleClass="text-luma-red"
            trailing={<span />}
          />
        </button>
      </section>
    </div>
  );
}
