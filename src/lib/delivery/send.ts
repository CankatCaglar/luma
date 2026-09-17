import { catalogId, parseMonthKey } from "@/lib/asana/map";
import {
  eventCategory,
  fillTemplate,
  formatMonthPhrase,
  notificationCopy,
  notificationHref,
} from "@/lib/delivery/copy";
import { sendPlainEmail } from "@/lib/delivery/resend";
import { readMailSettings, templateFor } from "@/lib/delivery/settings";
import {
  createDeliveryDoc,
  createNotificationDoc,
  getDelivery,
  updateDelivery,
} from "@/lib/delivery/store";
import type {
  ChannelChoice,
  DeliveryEventType,
  DeliveryRecord,
  DeliverySource,
} from "@/lib/delivery/types";
import {
  getTenantById,
  getTenantContactEmail,
  type TenantAccess,
} from "@/lib/tenant/access";

function jobHrefForEvent(
  eventType: DeliveryEventType,
  taskGid: string | undefined,
  kindHref: string | undefined,
): string {
  if (eventType === "approval_requested") return "/isler/onay";
  if (kindHref) return kindHref;
  if (eventType === "plan_ready") return "/planlar";
  if (eventType === "report_ready") return "/raporlar";
  return taskGid ? `/isler/gorev/${taskGid}` : "/";
}

function portalHref(
  eventType: DeliveryEventType,
  taskGid: string | undefined,
  monthKey: string | undefined,
): string {
  if (eventType === "plan_ready" && monthKey) {
    return `/planlar/${catalogId("plan", monthKey)}`;
  }
  if (eventType === "report_ready" && monthKey) {
    return `/raporlar/${catalogId("report", monthKey)}`;
  }
  return jobHrefForEvent(eventType, taskGid, undefined);
}

const PUBLIC_APP_URL = "https://luma.nerainnovations.com";

function publicAppUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  const raw = value.trim().replace(/\/$/, "");
  const href = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const url = new URL(href);
    const host = url.hostname.toLowerCase();
    if (url.protocol !== "https:") return null;
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
      return null;
    }
    return href.replace(/\/$/, "");
  } catch {
    return null;
  }
}

export function appBaseUrl(): string {
  return (
    publicAppUrl(process.env.LUMA_APP_URL) ||
    publicAppUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    publicAppUrl(process.env.VERCEL_PROJECT_PRODUCTION_URL) ||
    PUBLIC_APP_URL
  );
}

function absoluteLink(pathOrUrl: string | undefined, fallbackPath: string): string {
  if (pathOrUrl && /^https?:\/\//i.test(pathOrUrl)) return pathOrUrl;
  const path = pathOrUrl?.startsWith("/") ? pathOrUrl : fallbackPath;
  return `${appBaseUrl()}${path}`;
}

export type SendDeliveryInput = {
  tenant: TenantAccess;
  eventType: DeliveryEventType;
  taskTitle: string;
  taskGid?: string;
  customerLink?: string;
  monthKey?: string;
  fromSection?: string;
  toSection?: string;
  source: DeliverySource;
  channels?: Partial<ChannelChoice>;
  resentFromId?: string;
};

export async function sendDelivery(
  input: SendDeliveryInput,
): Promise<DeliveryRecord> {
  const settings = await readMailSettings();
  const template = templateFor(settings, input.eventType);
  const auto = input.source === "auto";
  const inAppEnabled =
    input.channels?.inApp ?? (auto ? template.autoInApp : true);
  const emailEnabled =
    input.channels?.email ?? (auto ? template.autoEmail : true);

  const monthKey =
    input.monthKey ||
    parseMonthKey(input.taskTitle, new Date().toISOString().slice(0, 10));
  const portalPath = portalHref(input.eventType, input.taskGid, monthKey);
  const portalUrl = absoluteLink(undefined, portalPath);
  const customerLink = input.customerLink?.trim();
  const link =
    customerLink && input.eventType === "approval_requested"
      ? `${customerLink}\n${portalUrl}`
      : customerLink || portalUrl;
  const month = formatMonthPhrase(monthKey);
  const vars = {
    title: input.taskTitle,
    link,
    month,
  };
  const subject = fillTemplate(template.subject, vars);
  const body = fillTemplate(template.body, vars);
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const contactEmail = getTenantContactEmail(input.tenant);

  let record = await createDeliveryDoc({
    tenantId: input.tenant.tenantId,
    brandName: input.tenant.brandName,
    brandCode: input.tenant.asana.brandCode,
    eventType: input.eventType,
    source: input.source,
    taskGid: input.taskGid,
    taskTitle: input.taskTitle,
    customerLink,
    monthKey,
    fromSection: input.fromSection,
    toSection: input.toSection,
    resentFromId: input.resentFromId,
    channels: {
      inApp: {
        enabled: inAppEnabled,
        status: inAppEnabled ? "queued" : "skipped",
        read: false,
      },
      email: {
        enabled: emailEnabled,
        status: emailEnabled ? "queued" : "skipped",
        to: contactEmail || undefined,
        subject,
      },
      push: { enabled: false, status: "skipped" },
    },
    createdAt,
    createdAtMs: now,
    updatedAtMs: now,
  });

  if (inAppEnabled) {
    try {
      const copy = notificationCopy(input.eventType, input.taskTitle);
      const href = notificationHref(input.eventType, portalPath);
      const notification = await createNotificationDoc({
        tenantId: input.tenant.tenantId,
        title: copy.title,
        body: copy.body,
        href,
        category: eventCategory(input.eventType),
        eventType: input.eventType,
        read: false,
        createdAt,
        createdAtMs: now,
        deliveryId: record.id,
        taskGid: input.taskGid,
      });
      await updateDelivery(record.id, {
        "channels.inApp.status": "sent",
        "channels.inApp.notificationId": notification.id,
      });
      record = {
        ...record,
        channels: {
          ...record.channels,
          inApp: {
            ...record.channels.inApp,
            status: "sent",
            notificationId: notification.id,
          },
        },
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bildirim yazılamadı";
      await updateDelivery(record.id, {
        "channels.inApp.status": "failed",
        "channels.inApp.error": message,
      });
      record = {
        ...record,
        channels: {
          ...record.channels,
          inApp: { ...record.channels.inApp, status: "failed", error: message },
        },
      };
    }
  }

  if (emailEnabled) {
    if (!contactEmail) {
      const message = "Markanın iletişim e-postası yok";
      await updateDelivery(record.id, {
        "channels.email.status": "failed",
        "channels.email.error": message,
      });
      record = {
        ...record,
        channels: {
          ...record.channels,
          email: { ...record.channels.email, status: "failed", error: message },
        },
      };
    } else {
      const result = await sendPlainEmail({
        to: contactEmail,
        subject,
        text: body,
      });
      if (result.error) {
        await updateDelivery(record.id, {
          "channels.email.status": "failed",
          "channels.email.to": contactEmail,
          "channels.email.subject": subject,
          "channels.email.error": result.error,
        });
        record = {
          ...record,
          channels: {
            ...record.channels,
            email: {
              ...record.channels.email,
              status: "failed",
              to: contactEmail,
              subject,
              error: result.error,
            },
          },
        };
      } else {
        await updateDelivery(record.id, {
          "channels.email.status": "sent",
          "channels.email.to": contactEmail,
          "channels.email.subject": subject,
          "channels.email.resendId": result.id ?? null,
          emailResendId: result.id ?? null,
        });
        record = {
          ...record,
          channels: {
            ...record.channels,
            email: {
              ...record.channels.email,
              status: "sent",
              to: contactEmail,
              subject,
              resendId: result.id,
            },
          },
        };
      }
    }
  }

  await updateDelivery(record.id, {
    channels: record.channels,
    emailResendId: record.channels.email.resendId ?? null,
  });

  return record;
}

export async function resendDelivery(id: string): Promise<DeliveryRecord> {
  const existing = await getDelivery(id);
  if (!existing) {
    throw new Error("İletim kaydı bulunamadı");
  }
  const tenant = await getTenantById(existing.tenantId);
  if (!tenant) {
    throw new Error("Marka bulunamadı");
  }
  return sendDelivery({
    tenant,
    eventType: existing.eventType,
    taskTitle: existing.taskTitle,
    taskGid: existing.taskGid,
    customerLink: existing.customerLink,
    monthKey: existing.monthKey,
    fromSection: existing.fromSection,
    toSection: existing.toSection,
    source: "manual",
    channels: {
      inApp: existing.channels.inApp.enabled,
      email: existing.channels.email.enabled,
    },
    resentFromId: existing.id,
  });
}
