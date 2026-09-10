"use client";

import { useState, type ReactNode } from "react";
import {
  Bell,
  ChevronRight,
  Languages,
  LogOut,
  Store,
  User,
} from "lucide-react";
import { displayPortalUsername } from "@/lib/auth/portalLogin";
import { currentBrand, currentUser } from "@/data/mock";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useJobs } from "@/components/jobs/JobsProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconTile } from "@/components/ui/IconTile";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
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
  chevron = false,
}: {
  icon: typeof User;
  tone?: "purple" | "gold" | "red";
  title: string;
  titleClass?: string;
  subtitle?: string;
  subtitleClass?: string;
  trailing?: ReactNode;
  chevron?: boolean;
}) {
  const Icon = icon;
  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <IconTile tone={tone} className="h-11 w-11">
        <Icon className="h-5 w-5" strokeWidth={1.8} />
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
      {trailing ?? (chevron ? <ChevronRight className="h-4 w-4 text-luma" /> : null)}
    </div>
  );
}

export default function HesabimPage() {
  const { t, locale, setLocale } = useI18n();
  const { user, signOutUser } = useAuth();
  const { data } = useJobs();
  const [busy, setBusy] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const username = displayPortalUsername(user?.email ?? currentUser.email);
  const brandName = data?.tenant.brandName ?? currentBrand.name;

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
      <div className="space-y-2.5">
        <section className="overflow-hidden rounded-2xl bg-luma-card ring-1 ring-luma-border/80">
          <Row icon={User} title={t("account.username")} subtitle={username} />
        </section>
        <section className="overflow-hidden rounded-2xl bg-luma-card ring-1 ring-luma-border/80">
          <Row
            icon={Store}
            tone="gold"
            title={t("account.activeBrand")}
            subtitle={brandName}
            subtitleClass="font-semibold text-luma-gold"
          />
        </section>
      </div>

      <p className="mb-2 mt-5 text-xs font-semibold tracking-wide text-luma-muted">
        {t("account.settings")}
      </p>
      <section className="overflow-hidden rounded-2xl bg-luma-card ring-1 ring-luma-border/80">
        <Row
          icon={Bell}
          title={t("account.notificationPrefs")}
          subtitle={t("account.notificationPrefsSub")}
        />
      </section>

      <section className="mt-3 rounded-2xl bg-luma-card ring-1 ring-luma-border/80">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <IconTile className="h-11 w-11">
            <Languages className="h-5 w-5" strokeWidth={1.8} />
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

      {error ? (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-luma-red">
          {error}
        </p>
      ) : null}

      <section className="mt-5 overflow-hidden rounded-2xl bg-luma-card ring-1 ring-luma-border/80">
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirmOpen(true)}
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
      <ConfirmDialog
        open={confirmOpen}
        busy={busy}
        tone="danger"
        title={t("account.logoutConfirmTitle")}
        description={t("account.logoutConfirmDescription")}
        confirmLabel={t("account.logout")}
        cancelLabel={t("account.cancel")}
        onCancel={() => {
          if (!busy) setConfirmOpen(false);
        }}
        onConfirm={async () => {
          setBusy(true);
          setError(null);
          try {
            await signOutUser();
          } catch {
            setError(t("account.authNotReady"));
            setBusy(false);
            setConfirmOpen(false);
          }
        }}
      />
    </div>
  );
}
