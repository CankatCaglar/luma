import type { NotificationCategory } from "@/types";

export const DELIVERY_EVENT_TYPES = [
  "plan_ready",
  "report_ready",
  "work_ready",
  "approval_requested",
  "revision_done",
] as const;

export type DeliveryEventType = (typeof DELIVERY_EVENT_TYPES)[number];

export type DeliverySource = "auto" | "manual";

export type EmailDeliveryStatus =
  | "skipped"
  | "queued"
  | "sent"
  | "delivered"
  | "opened"
  | "bounced"
  | "failed";

export type InAppDeliveryStatus = "skipped" | "queued" | "sent" | "failed";

export type ChannelChoice = {
  inApp: boolean;
  email: boolean;
};

export type MailTemplate = {
  subject: string;
  body: string;
  autoEmail: boolean;
  autoInApp: boolean;
};

export type MailSettings = {
  templates: Record<DeliveryEventType, MailTemplate>;
  updatedAt?: number;
};

export type DeliveryRecord = {
  id: string;
  tenantId: string;
  brandName: string;
  brandCode: string;
  eventType: DeliveryEventType;
  source: DeliverySource;
  taskGid?: string;
  taskTitle: string;
  customerLink?: string;
  monthKey?: string;
  fromSection?: string;
  toSection?: string;
  resentFromId?: string;
  channels: {
    inApp: {
      enabled: boolean;
      status: InAppDeliveryStatus;
      notificationId?: string;
      read: boolean;
      error?: string;
    };
    email: {
      enabled: boolean;
      status: EmailDeliveryStatus;
      to?: string;
      subject?: string;
      resendId?: string;
      error?: string;
    };
    push: {
      enabled: boolean;
      status: "skipped";
    };
  };
  createdAt: string;
  createdAtMs: number;
  updatedAtMs: number;
};

export type StoredNotification = {
  id: string;
  tenantId: string;
  title: string;
  body: string;
  href: string;
  category: NotificationCategory;
  eventType: DeliveryEventType;
  read: boolean;
  createdAt: string;
  createdAtMs: number;
  deliveryId: string;
  taskGid?: string;
};

export function isDeliveryEventType(value: string): value is DeliveryEventType {
  return (DELIVERY_EVENT_TYPES as readonly string[]).includes(value);
}
