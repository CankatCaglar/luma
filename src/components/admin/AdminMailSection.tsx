"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCcw, Save } from "lucide-react";
import { DELIVERY_EVENT_TYPES, type DeliveryEventType, type MailSettings } from "@/lib/delivery/types";
import { EVENT_LABELS, defaultMailSettings } from "@/lib/delivery/copy";

type AuthHeaders = () => Promise<Record<string, string>>;

type ResendStatus = {
  configured: boolean;
  from: string;
  domains: Array<{ name: string; status: string; region?: string }>;
  error?: string;
};

export function AdminMailSection({ authHeaders }: { authHeaders: AuthHeaders }) {
  const [settings, setSettings] = useState<MailSettings>(defaultMailSettings());
  const [resend, setResend] = useState<ResendStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [openType, setOpenType] = useState<DeliveryEventType>("plan_ready");

  const load = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setError(null);
    try {
      const response = await fetch("/api/admin/mail-settings", {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        settings?: MailSettings;
        resend?: ResendStatus;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Ayarlar alınamadı");
      if (payload?.settings) setSettings(payload.settings);
      setResend(payload?.resend ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ayarlar alınamadı");
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch("/api/admin/mail-settings", {
          cache: "no-store",
          headers: await authHeaders(),
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          settings?: MailSettings;
          resend?: ResendStatus;
        } | null;
        if (cancelled) return;
        if (!response.ok) throw new Error(payload?.error ?? "Ayarlar alınamadı");
        if (payload?.settings) setSettings(payload.settings);
        setResend(payload?.resend ?? null);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Ayarlar alınamadı");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders]);

  async function onSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/admin/mail-settings", {
        method: "PUT",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ templates: settings.templates }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        settings?: MailSettings;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Kaydedilemedi");
      if (payload?.settings) setSettings(payload.settings);
      setSuccess("Mail metinleri kaydedildi.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kaydedilemedi");
    } finally {
      setSaving(false);
    }
  }

  const template = settings.templates[openType];

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-4 shadow-[0_16px_48px_rgba(28,25,23,0.08)] ring-1 ring-luma-border/80 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">Resend durumu</h2>
            <p className="mt-1 text-sm text-luma-muted">
              Gönderen: {resend?.from ?? "Luma by Nera <innovations@nerasocial.com>"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load({ silent: true })}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-luma-muted hover:bg-luma-soft"
            aria-label="Yenile"
          >
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {resend?.error ? (
          <p className="mt-3 rounded-xl bg-[#f8eee8] px-3 py-2 text-sm text-[#9a3412]">
            {resend.error}
          </p>
        ) : null}
        <ul className="mt-3 space-y-2 text-sm">
          <li className="flex items-center justify-between rounded-xl bg-luma-soft px-3 py-2">
            <span className="text-luma-muted">API anahtarı</span>
            <span className="font-semibold text-foreground">
              {resend?.configured ? "Tanımlı" : "Eksik"}
            </span>
          </li>
          {(resend?.domains ?? []).map((domain) => (
            <li
              key={domain.name}
              className="flex items-center justify-between rounded-xl bg-luma-soft px-3 py-2"
            >
              <span className="text-luma-muted">{domain.name}</span>
              <span className="font-semibold capitalize text-foreground">{domain.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-[0_16px_48px_rgba(28,25,23,0.08)] ring-1 ring-luma-border/80 sm:p-5">
        <h2 className="text-base font-bold text-foreground">Otomatik mail metinleri</h2>
        <p className="mt-1 text-sm text-luma-muted">
          Dinamik alanlar: {"{title}"}, {"{link}"}, {"{month}"}. Şablon ürünü yok; düz metin gider.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {DELIVERY_EVENT_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => setOpenType(type)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${
                openType === type
                  ? "bg-luma text-white"
                  : "bg-luma-soft text-luma-muted"
              }`}
            >
              {EVENT_LABELS[type]}
            </button>
          ))}
        </div>
        {loading ? (
          <div className="mt-6 flex justify-center py-8 text-luma-muted">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <label className="block text-sm font-semibold text-foreground">
              Konu
              <input
                value={template.subject}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    templates: {
                      ...prev.templates,
                      [openType]: { ...prev.templates[openType], subject: event.target.value },
                    },
                  }))
                }
                className="mt-1 w-full rounded-xl border border-luma-border bg-white px-3 py-2 text-sm font-normal"
              />
            </label>
            <label className="block text-sm font-semibold text-foreground">
              Metin
              <textarea
                value={template.body}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    templates: {
                      ...prev.templates,
                      [openType]: { ...prev.templates[openType], body: event.target.value },
                    },
                  }))
                }
                rows={8}
                className="mt-1 w-full rounded-xl border border-luma-border bg-white px-3 py-2 text-sm font-normal leading-relaxed"
              />
            </label>
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={template.autoEmail}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      templates: {
                        ...prev.templates,
                        [openType]: {
                          ...prev.templates[openType],
                          autoEmail: event.target.checked,
                        },
                      },
                    }))
                  }
                />
                Otomatik mail
              </label>
              <label className="flex items-center gap-2 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={template.autoInApp}
                  onChange={(event) =>
                    setSettings((prev) => ({
                      ...prev,
                      templates: {
                        ...prev.templates,
                        [openType]: {
                          ...prev.templates[openType],
                          autoInApp: event.target.checked,
                        },
                      },
                    }))
                  }
                />
                Otomatik uygulama içi bildirim
              </label>
            </div>
            <button
              type="button"
              onClick={() => void onSave()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-luma px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Kaydet
            </button>
          </div>
        )}
        {error ? <p className="mt-3 text-sm text-[#9a3412]">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-luma">{success}</p> : null}
      </section>
    </div>
  );
}
