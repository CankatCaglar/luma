import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import { defaultMailSettings } from "@/lib/delivery/copy";
import {
  DELIVERY_EVENT_TYPES,
  isDeliveryEventType,
  type DeliveryEventType,
  type MailSettings,
  type MailTemplate,
} from "@/lib/delivery/types";

const SETTINGS_COLLECTION = "appSettings";
const SETTINGS_DOC = "mail";

function asTemplate(value: unknown, fallback: MailTemplate): MailTemplate {
  if (!value || typeof value !== "object") return { ...fallback };
  const record = value as Partial<MailTemplate>;
  return {
    subject: typeof record.subject === "string" && record.subject.trim()
      ? record.subject
      : fallback.subject,
    body: typeof record.body === "string" && record.body.trim()
      ? record.body
      : fallback.body,
    autoEmail: record.autoEmail !== false,
    autoInApp: record.autoInApp !== false,
  };
}

export function normalizeMailSettings(value: unknown): MailSettings {
  const defaults = defaultMailSettings();
  const record =
    value && typeof value === "object"
      ? (value as { templates?: Record<string, unknown>; updatedAt?: unknown })
      : {};
  const templates = { ...defaults.templates };
  for (const eventType of DELIVERY_EVENT_TYPES) {
    templates[eventType] = asTemplate(
      record.templates?.[eventType],
      defaults.templates[eventType],
    );
  }
  return {
    templates,
    updatedAt:
      typeof record.updatedAt === "number" ? record.updatedAt : undefined,
  };
}

export async function readMailSettings(): Promise<MailSettings> {
  try {
    const snap = await getAdminDb()
      .collection(SETTINGS_COLLECTION)
      .doc(SETTINGS_DOC)
      .get();
    if (!snap.exists) return defaultMailSettings();
    return normalizeMailSettings(snap.data());
  } catch {
    return defaultMailSettings();
  }
}

export async function writeMailSettings(
  input: MailSettings,
): Promise<MailSettings> {
  const next = normalizeMailSettings(input);
  await getAdminDb().collection(SETTINGS_COLLECTION).doc(SETTINGS_DOC).set(
    {
      templates: next.templates,
      updatedAt: Date.now(),
      updatedAtServer: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );
  return readMailSettings();
}

export function templateFor(
  settings: MailSettings,
  eventType: DeliveryEventType,
): MailTemplate {
  return settings.templates[eventType] ?? defaultMailSettings().templates[eventType];
}

export function parseMailSettingsBody(input: unknown): MailSettings {
  if (!input || typeof input !== "object") {
    throw new Error("Geçersiz mail ayarı");
  }
  const templates = (input as { templates?: unknown }).templates;
  if (!templates || typeof templates !== "object") {
    throw new Error("Şablonlar gerekli");
  }
  for (const key of Object.keys(templates as object)) {
    if (!isDeliveryEventType(key)) {
      throw new Error(`Bilinmeyen olay tipi: ${key}`);
    }
  }
  return normalizeMailSettings({ templates });
}
