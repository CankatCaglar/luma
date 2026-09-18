"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, RefreshCcw, Send, Trash2 } from "lucide-react";
import {
  DELIVERY_EVENT_TYPES,
  type DeliveryEventType,
  type DeliveryRecord,
} from "@/lib/delivery/types";
import { EVENT_LABELS } from "@/lib/delivery/copy";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type AuthHeaders = () => Promise<Record<string, string>>;

type TenantOption = {
  tenantId: string;
  brandName: string;
  asana: { brandCode: string };
  contactEmail?: string;
};

const EMAIL_STATUS_LABEL: Record<string, string> = {
  skipped: "Atlandı",
  queued: "Kuyrukta",
  sent: "Gönderildi",
  delivered: "Ulaştı",
  opened: "Görüntülendi",
  bounced: "Geri döndü",
  failed: "Başarısız",
};

function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function AdminNotificationsSection({
  authHeaders,
  tenants,
}: {
  authHeaders: AuthHeaders;
  tenants: TenantOption[];
}) {
  const [deliveries, setDeliveries] = useState<DeliveryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [filterTenant, setFilterTenant] = useState("");
  const [form, setForm] = useState({
    tenantId: "",
    eventType: "work_ready" as DeliveryEventType,
    taskTitle: "",
    customerLink: "",
    inApp: true,
    email: true,
  });

  const load = useCallback(async () => {
    setError(null);
    try {
      const query = filterTenant ? `?tenantId=${encodeURIComponent(filterTenant)}` : "";
      const response = await fetch(`/api/admin/deliveries${query}`, {
        cache: "no-store",
        headers: await authHeaders(),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        deliveries?: DeliveryRecord[];
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Geçmiş alınamadı");
      setDeliveries(payload?.deliveries ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Geçmiş alınamadı");
    } finally {
      setLoading(false);
    }
  }, [authHeaders, filterTenant]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const query = filterTenant ? `?tenantId=${encodeURIComponent(filterTenant)}` : "";
        const response = await fetch(`/api/admin/deliveries${query}`, {
          cache: "no-store",
          headers: await authHeaders(),
        });
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          deliveries?: DeliveryRecord[];
        } | null;
        if (cancelled) return;
        if (!response.ok) throw new Error(payload?.error ?? "Geçmiş alınamadı");
        setDeliveries(payload?.deliveries ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Geçmiş alınamadı");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHeaders, filterTenant]);

  const tenantOptions = useMemo(
    () =>
      tenants.map((tenant) => ({
        id: tenant.tenantId,
        label: `${tenant.brandName} (${tenant.asana.brandCode})`,
      })),
    [tenants],
  );

  const selectedTenant = useMemo(
    () => tenants.find((tenant) => tenant.tenantId === form.tenantId),
    [form.tenantId, tenants],
  );
  const selectedHasContact = Boolean(selectedTenant?.contactEmail?.trim());

  async function onManualSend() {
    setSending(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/admin/deliveries", {
        method: "POST",
        headers: {
          ...(await authHeaders()),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tenantId: form.tenantId,
          eventType: form.eventType,
          taskTitle: form.taskTitle,
          customerLink: form.customerLink || undefined,
          inApp: form.inApp,
          email: form.email,
        }),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        delivery?: DeliveryRecord;
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Gönderilemedi");
      const delivery = payload?.delivery;
      const email = delivery?.channels.email;
      if (email?.enabled && email.status === "failed") {
        setError(
          `Mail gitmedi${email.to ? ` (${email.to})` : ""}: ${email.error ?? "Bilinmeyen hata"}`,
        );
      } else if (email?.enabled && email.status === "skipped") {
        setSuccess(
          email.error ??
            "Bildirim oluşturuldu. İletişim e-postası olmadığı için mail gönderilmedi.",
        );
      } else if (email?.enabled && email.to) {
        setSuccess(`Gönderildi. Mail: ${email.to}`);
      } else {
        setSuccess("Gönderim oluşturuldu.");
      }
      setForm((prev) => ({ ...prev, taskTitle: "", customerLink: "" }));
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gönderilemedi");
    } finally {
      setSending(false);
    }
  }

  async function onResend(id: string) {
    setResendingId(id);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/deliveries/${id}/resend`, {
        method: "POST",
        headers: await authHeaders(),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Yeniden gönderilemedi");
      setSuccess("Yeniden gönderildi.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Yeniden gönderilemedi");
    } finally {
      setResendingId(null);
    }
  }

  async function onScan() {
    setScanning(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch("/api/admin/deliveries/scan", {
        method: "POST",
        headers: await authHeaders(),
      });
      const payload = (await response.json().catch(() => null)) as {
        error?: string;
        sent?: number;
        transitions?: number;
        errors?: string[];
      } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Tarama başarısız");
      const extra = payload?.errors?.length ? ` Uyarı: ${payload.errors.join(" · ")}` : "";
      setSuccess(
        `Asana tarandı. ${payload?.transitions ?? 0} geçiş, ${payload?.sent ?? 0} gönderim.${extra}`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tarama başarısız");
    } finally {
      setScanning(false);
    }
  }

  async function onDelete() {
    if (!pendingDeleteId || deleting) return;
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await fetch(`/api/admin/deliveries/${pendingDeleteId}`, {
        method: "DELETE",
        headers: await authHeaders(),
      });
      const payload = (await response.json().catch(() => null)) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error ?? "Kayıt kaldırılamadı");
      setPendingDeleteId(null);
      setSuccess("Kayıt kaldırıldı.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kayıt kaldırılamadı");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-4">
      <section className="rounded-3xl bg-white p-4 shadow-[0_16px_48px_rgba(28,25,23,0.08)] ring-1 ring-luma-border/80 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-foreground">Manuel gönderim</h2>
            <p className="mt-1 text-sm text-luma-muted">
              Marka, olay ve başlık yeterli. İstersen sadece mail veya sadece bildirim gönder.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void onScan()}
            disabled={scanning}
            className="inline-flex items-center gap-2 rounded-xl border border-luma-border px-3 py-2 text-sm font-semibold text-foreground disabled:opacity-60"
          >
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            Asana tara
          </button>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold text-foreground">
            Marka
            <select
              value={form.tenantId}
              onChange={(event) => setForm((prev) => ({ ...prev, tenantId: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-luma-border bg-white px-3 py-2 text-sm font-normal"
            >
              <option value="">Seçin</option>
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.label}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-foreground">
            Olay
            <select
              value={form.eventType}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  eventType: event.target.value as DeliveryEventType,
                }))
              }
              className="mt-1 w-full rounded-xl border border-luma-border bg-white px-3 py-2 text-sm font-normal"
            >
              {DELIVERY_EVENT_TYPES.map((type) => (
                <option key={type} value={type}>
                  {EVENT_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold text-foreground">
            Task başlığı
            <input
              value={form.taskTitle}
              onChange={(event) => setForm((prev) => ({ ...prev, taskTitle: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-luma-border bg-white px-3 py-2 text-sm font-normal"
              placeholder="Eylül içerik planı"
            />
          </label>
          <label className="text-sm font-semibold text-foreground">
            Dosya linki
            <input
              value={form.customerLink}
              onChange={(event) => setForm((prev) => ({ ...prev, customerLink: event.target.value }))}
              className="mt-1 w-full rounded-xl border border-luma-border bg-white px-3 py-2 text-sm font-normal"
              placeholder="Drive / Sheets (opsiyonel)"
            />
          </label>
        </div>
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.inApp}
              onChange={(event) => setForm((prev) => ({ ...prev, inApp: event.target.checked }))}
            />
            Uygulama içi bildirim
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.email}
              onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.checked }))}
            />
            Mail
          </label>
        </div>
        {form.email && form.tenantId && !selectedHasContact ? (
          <p className="mt-2 text-sm text-[#9a3412]">
            Bu markanın iletişim e-postası yok. Mail gönderilmez; yalnızca uygulama içi bildirim gider.
          </p>
        ) : null}
        <button
          type="button"
          onClick={() => void onManualSend()}
          disabled={sending}
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-luma px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
        >
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Gönder
        </button>
      </section>

      <section className="rounded-3xl bg-white p-4 shadow-[0_16px_48px_rgba(28,25,23,0.08)] ring-1 ring-luma-border/80 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-foreground">İletim Geçmişi</h2>
          <div className="flex items-center gap-2">
            <select
              value={filterTenant}
              onChange={(event) => setFilterTenant(event.target.value)}
              className="rounded-xl border border-luma-border bg-white px-3 py-2 text-sm"
            >
              <option value="">Tüm markalar</option>
              {tenantOptions.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-luma-muted hover:bg-luma-soft"
              aria-label="Yenile"
            >
              <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
        {error ? <p className="mt-3 text-sm text-[#9a3412]">{error}</p> : null}
        {success ? <p className="mt-3 text-sm text-luma">{success}</p> : null}
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-luma-muted">
              <tr>
                <th className="px-2 py-2 font-semibold">Zaman</th>
                <th className="px-2 py-2 font-semibold">Marka</th>
                <th className="px-2 py-2 font-semibold">Olay</th>
                <th className="px-2 py-2 font-semibold">Başlık</th>
                <th className="px-2 py-2 font-semibold">Mail</th>
                <th className="px-2 py-2 font-semibold">Bildirim</th>
                <th className="px-2 py-2 font-semibold">Kaynak</th>
                <th className="px-2 py-2 font-semibold" />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-2 py-8 text-center text-luma-muted">
                    Yükleniyor...
                  </td>
                </tr>
              ) : deliveries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-2 py-8 text-center text-luma-muted">
                    Henüz iletim kaydı yok.
                  </td>
                </tr>
              ) : (
                deliveries.map((item) => (
                  <tr key={item.id} className="border-t border-luma-border/80">
                    <td className="whitespace-nowrap px-2 py-2 text-luma-muted">
                      {formatWhen(item.createdAt)}
                    </td>
                    <td className="px-2 py-2 font-medium">{item.brandName}</td>
                    <td className="px-2 py-2">{EVENT_LABELS[item.eventType]}</td>
                    <td className="max-w-[14rem] truncate px-2 py-2" title={item.taskTitle}>
                      {item.taskTitle}
                    </td>
                    <td className="px-2 py-2">
                      {item.channels.email.enabled
                        ? EMAIL_STATUS_LABEL[item.channels.email.status] ??
                          item.channels.email.status
                        : "Kapalı"}
                      {item.channels.email.to ? (
                        <span className="block max-w-[12rem] truncate text-[11px] text-luma-muted" title={item.channels.email.to}>
                          {item.channels.email.to}
                        </span>
                      ) : null}
                      {item.channels.email.error ? (
                        <span className="block max-w-[12rem] truncate text-[11px] text-[#9a3412]" title={item.channels.email.error}>
                          {item.channels.email.error}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-2 py-2">
                      {!item.channels.inApp.enabled
                        ? "Kapalı"
                        : item.channels.inApp.read
                          ? "Görüldü"
                          : item.channels.inApp.status === "sent"
                            ? "Gönderildi"
                            : EMAIL_STATUS_LABEL[item.channels.inApp.status] ??
                              item.channels.inApp.status}
                    </td>
                    <td className="px-2 py-2 text-luma-muted">
                      {item.source === "manual" ? "Manuel" : "Otomatik"}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => void onResend(item.id)}
                          disabled={resendingId === item.id || deleting}
                          className="text-sm font-semibold text-luma disabled:opacity-60"
                        >
                          {resendingId === item.id ? "Gönderiliyor..." : "Yeniden gönder"}
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteId(item.id)}
                          disabled={deleting}
                          className="text-sm font-semibold text-[#9a3412] disabled:opacity-60"
                        >
                          Kaldır
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      <ConfirmDialog
        open={Boolean(pendingDeleteId)}
        busy={deleting}
        tone="danger"
        icon={<Trash2 className="h-5 w-5" />}
        title="Kaydı kaldır?"
        description="Bu iletim geçmişten silinir. Varsa uygulamadaki bildirimi de kalkar. Giden mail geri alınmaz."
        confirmLabel="Kaldır"
        cancelLabel="Vazgeç"
        onCancel={() => {
          if (!deleting) setPendingDeleteId(null);
        }}
        onConfirm={() => void onDelete()}
      />
    </div>
  );
}
