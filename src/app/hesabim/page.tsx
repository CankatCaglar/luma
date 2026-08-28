"use client";

import { useState, type ReactNode } from "react";
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
import { sendPasswordResetEmail } from "firebase/auth";
import { currentBrand, currentUser } from "@/data/mock";
import { useI18n } from "@/components/i18n/I18nProvider";
import { useAuth } from "@/components/auth/AuthProvider";
import { useJobs } from "@/components/jobs/JobsProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconTile } from "@/components/ui/IconTile";
import { cn } from "@/lib/cn";
import { firebaseAuth, firebaseEnabled } from "@/lib/firebase/client";
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
  const { user, signOutUser } = useAuth();
  const { data } = useJobs();
  const [busyKey, setBusyKey] = useState<"reset" | "logout" | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = user?.displayName ?? currentUser.name;
  const email = user?.email ?? currentUser.email;
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
      <section className="divide-y divide-luma-border overflow-hidden rounded-2xl bg-luma-card ring-1 ring-luma-border/80">
        <Row icon={User} title={t("account.name")} subtitle={name} />
        <Row icon={Mail} title={t("account.email")} subtitle={email} />
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
          subtitle={brandName}
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

      <section className="mt-3 space-y-2 rounded-2xl bg-luma-card p-4 ring-1 ring-luma-border/80">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("account.resetPasswordEmail")}
            </p>
            <p className="mt-0.5 text-sm text-luma-muted">{email}</p>
          </div>
          <button
            type="button"
            disabled={!firebaseEnabled || !firebaseAuth || !email || busyKey !== null}
            onClick={async () => {
              if (!firebaseAuth || !email) return;
              setBusyKey("reset");
              setError(null);
              setInfo(null);
              try {
                await sendPasswordResetEmail(firebaseAuth, email, {
                  url: `${window.location.origin}/giris`,
                });
                setInfo(t("account.actionSent"));
              } catch {
                setError(t("account.authNotReady"));
              } finally {
                setBusyKey(null);
              }
            }}
            className="shrink-0 rounded-xl border border-luma-border px-3 py-2 text-xs font-semibold text-luma transition-transform duration-150 ease-out active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-55"
          >
            {t("account.sendResetLink")}
          </button>
        </div>

        {info ? (
          <p className="rounded-xl bg-luma-soft px-3 py-2 text-xs font-semibold text-luma">
            {info}
          </p>
        ) : null}
        {error ? (
          <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-luma-red">
            {error}
          </p>
        ) : null}
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
          disabled={busyKey !== null}
          onClick={async () => {
            setBusyKey("logout");
            setError(null);
            setInfo(null);
            try {
              await signOutUser();
            } catch {
              setError(t("account.authNotReady"));
            } finally {
              setBusyKey(null);
            }
          }}
          className="w-full select-none text-left transition-transform duration-150 ease-out active:scale-[0.97]"
        >
          <Row
            icon={LogOut}
            tone="red"
            title={busyKey === "logout" ? "Çıkış yapılıyor..." : t("account.logout")}
            titleClass="text-luma-red"
            trailing={<span />}
          />
        </button>
      </section>
    </div>
  );
}
