import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";
import type {
  DeliveryRecord,
  EmailDeliveryStatus,
  StoredNotification,
} from "@/lib/delivery/types";

const DELIVERIES = "deliveries";
const NOTIFICATIONS = "notifications";

function asString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asBoolean(value: unknown, fallback = false): boolean {
  return typeof value === "boolean" ? value : fallback;
}

export function serializeDelivery(
  id: string,
  data: FirebaseFirestore.DocumentData,
): DeliveryRecord | null {
  const tenantId = asString(data.tenantId);
  const eventType = asString(data.eventType);
  const taskTitle = asString(data.taskTitle);
  if (!tenantId || !eventType || !taskTitle) return null;

  const email = (data.channels?.email ?? {}) as Record<string, unknown>;
  const inApp = (data.channels?.inApp ?? {}) as Record<string, unknown>;
  const createdAtMs = asNumber(data.createdAtMs) ?? Date.now();
  const inAppNotificationId =
    asString(inApp.notificationId) ?? asString(data["channels.inApp.notificationId"]);
  const emailError = asString(email.error) ?? asString(data["channels.email.error"]);
  const emailResendId =
    asString(email.resendId) ??
    asString(data.emailResendId) ??
    asString(data["channels.email.resendId"]);
  const inAppStatusRaw =
    asString(data["channels.inApp.status"]) ?? asString(inApp.status);
  const emailStatusRaw =
    asString(data["channels.email.status"]) ?? asString(email.status);
  const inAppStatus =
    inAppStatusRaw === "queued" && inAppNotificationId ? "sent" : inAppStatusRaw;
  const emailStatus =
    emailStatusRaw === "queued" && emailError
      ? "failed"
      : emailStatusRaw === "queued" && emailResendId
        ? "sent"
        : emailStatusRaw;

  return {
    id,
    tenantId,
    brandName: asString(data.brandName) ?? "",
    brandCode: asString(data.brandCode) ?? "",
    eventType: eventType as DeliveryRecord["eventType"],
    source: data.source === "manual" ? "manual" : "auto",
    taskGid: asString(data.taskGid),
    taskTitle,
    customerLink: asString(data.customerLink),
    monthKey: asString(data.monthKey),
    fromSection: asString(data.fromSection),
    toSection: asString(data.toSection),
    resentFromId: asString(data.resentFromId),
    channels: {
      inApp: {
        enabled: asBoolean(inApp.enabled),
        status: (inAppStatus as DeliveryRecord["channels"]["inApp"]["status"]) ?? "skipped",
        notificationId: inAppNotificationId,
        read: asBoolean(inApp.read) || asBoolean(data["channels.inApp.read"]),
        error: asString(inApp.error) ?? asString(data["channels.inApp.error"]),
      },
      email: {
        enabled: asBoolean(email.enabled),
        status: (emailStatus as EmailDeliveryStatus) ?? "skipped",
        to: asString(email.to) ?? asString(data["channels.email.to"]),
        subject: asString(email.subject) ?? asString(data["channels.email.subject"]),
        resendId: emailResendId,
        error: emailError,
      },
      push: {
        enabled: false,
        status: "skipped",
      },
    },
    createdAt: asString(data.createdAt) ?? new Date(createdAtMs).toISOString(),
    createdAtMs,
    updatedAtMs: asNumber(data.updatedAtMs) ?? createdAtMs,
  };
}

export function serializeNotification(
  id: string,
  data: FirebaseFirestore.DocumentData,
): StoredNotification | null {
  const tenantId = asString(data.tenantId);
  const title = asString(data.title);
  const href = asString(data.href) ?? "/";
  const eventType = asString(data.eventType);
  if (!tenantId || !title || !eventType) return null;
  const createdAtMs = asNumber(data.createdAtMs) ?? Date.now();
  return {
    id,
    tenantId,
    title,
    body: asString(data.body) ?? "",
    href,
    category: (asString(data.category) as StoredNotification["category"]) ?? "status",
    eventType: eventType as StoredNotification["eventType"],
    read: asBoolean(data.read),
    createdAt: asString(data.createdAt) ?? new Date(createdAtMs).toISOString(),
    createdAtMs,
    deliveryId: asString(data.deliveryId) ?? "",
    taskGid: asString(data.taskGid),
  };
}

function omitUndefined(value: Record<string, unknown>): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item === undefined) continue;
    if (
      item &&
      typeof item === "object" &&
      !Array.isArray(item) &&
      Object.getPrototypeOf(item) === Object.prototype
    ) {
      next[key] = omitUndefined(item as Record<string, unknown>);
    } else {
      next[key] = item;
    }
  }
  return next;
}

export async function createDeliveryDoc(
  record: Omit<DeliveryRecord, "id">,
): Promise<DeliveryRecord> {
  const ref = getAdminDb().collection(DELIVERIES).doc();
  const payload = omitUndefined({
    ...record,
    emailResendId: record.channels.email.resendId ?? null,
    createdAtServer: FieldValue.serverTimestamp(),
  });
  await ref.set(payload);
  return { ...record, id: ref.id };
}

function applyPatch(
  current: Record<string, unknown>,
  patch: Record<string, unknown>,
): Record<string, unknown> {
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (!key.includes(".")) {
      next[key] = value;
      continue;
    }
    const parts = key.split(".");
    let cursor: Record<string, unknown> = next;
    for (let i = 0; i < parts.length - 1; i += 1) {
      const part = parts[i];
      const child = cursor[part];
      cursor[part] =
        child && typeof child === "object" && !Array.isArray(child)
          ? { ...(child as Record<string, unknown>) }
          : {};
      cursor = cursor[part] as Record<string, unknown>;
    }
    cursor[parts[parts.length - 1]] = value;
  }
  return next;
}

export async function updateDelivery(
  id: string,
  patch: Record<string, unknown>,
): Promise<void> {
  const ref = getAdminDb().collection(DELIVERIES).doc(id);
  const snap = await ref.get();
  if (!snap.exists) return;
  const next = applyPatch(snap.data() ?? {}, omitUndefined(patch));
  next.updatedAtMs = Date.now();
  await ref.set(next);
}

export async function getDelivery(id: string): Promise<DeliveryRecord | null> {
  const snap = await getAdminDb().collection(DELIVERIES).doc(id).get();
  if (!snap.exists) return null;
  return serializeDelivery(snap.id, snap.data() ?? {});
}

export async function listDeliveries(input?: {
  tenantId?: string;
  limit?: number;
}): Promise<DeliveryRecord[]> {
  const limit = Math.min(Math.max(input?.limit ?? 80, 1), 200);
  const col = getAdminDb().collection(DELIVERIES);
  let snap: FirebaseFirestore.QuerySnapshot;
  try {
    snap = input?.tenantId
      ? await col.where("tenantId", "==", input.tenantId).limit(limit).get()
      : await col.orderBy("createdAtMs", "desc").limit(limit).get();
  } catch {
    snap = await col.limit(limit).get();
  }

  const items = snap.docs
    .map((doc) => serializeDelivery(doc.id, doc.data()))
    .filter((item): item is DeliveryRecord => item !== null)
    .sort((left, right) => right.createdAtMs - left.createdAtMs);
  return items.slice(0, limit);
}

export async function deleteDelivery(id: string): Promise<boolean> {
  const existing = await getDelivery(id);
  if (!existing) return false;
  const db = getAdminDb();
  const batch = db.batch();
  batch.delete(db.collection(DELIVERIES).doc(id));
  const notificationId = existing.channels.inApp.notificationId;
  if (notificationId) {
    batch.delete(db.collection(NOTIFICATIONS).doc(notificationId));
  } else {
    const linked = await db
      .collection(NOTIFICATIONS)
      .where("deliveryId", "==", id)
      .limit(10)
      .get();
    for (const doc of linked.docs) batch.delete(doc.ref);
  }
  await batch.commit();
  return true;
}

export async function findDeliveryByResendId(
  resendId: string,
): Promise<DeliveryRecord | null> {
  const snap = await getAdminDb()
    .collection(DELIVERIES)
    .where("emailResendId", "==", resendId)
    .limit(1)
    .get();
  const first = snap.docs[0];
  if (!first) return null;
  return serializeDelivery(first.id, first.data());
}

export async function createNotificationDoc(
  record: Omit<StoredNotification, "id">,
): Promise<StoredNotification> {
  const ref = getAdminDb().collection(NOTIFICATIONS).doc();
  await ref.set(
    omitUndefined({
      ...record,
      createdAtServer: FieldValue.serverTimestamp(),
    }),
  );
  return { ...record, id: ref.id };
}

export async function listNotifications(
  tenantId: string,
  limit = 80,
): Promise<StoredNotification[]> {
  const snap = await getAdminDb()
    .collection(NOTIFICATIONS)
    .where("tenantId", "==", tenantId)
    .limit(Math.min(Math.max(limit, 1), 200))
    .get();
  return snap.docs
    .map((doc) => serializeNotification(doc.id, doc.data()))
    .filter((item): item is StoredNotification => item !== null)
    .sort((left, right) => right.createdAtMs - left.createdAtMs);
}

export async function getNotification(
  id: string,
): Promise<StoredNotification | null> {
  const snap = await getAdminDb().collection(NOTIFICATIONS).doc(id).get();
  if (!snap.exists) return null;
  return serializeNotification(snap.id, snap.data() ?? {});
}

export async function markNotificationRead(
  id: string,
  tenantId: string,
): Promise<StoredNotification | null> {
  const existing = await getNotification(id);
  if (!existing || existing.tenantId !== tenantId) return null;
  if (!existing.read) {
    await getAdminDb().collection(NOTIFICATIONS).doc(id).set(
      { read: true, updatedAtMs: Date.now() },
      { merge: true },
    );
    if (existing.deliveryId) {
      await updateDelivery(existing.deliveryId, {
        "channels.inApp.read": true,
      });
    }
  }
  return { ...existing, read: true };
}

export async function deleteNotification(
  id: string,
  tenantId: string,
): Promise<boolean> {
  const existing = await getNotification(id);
  if (!existing || existing.tenantId !== tenantId) return false;
  await getAdminDb().collection(NOTIFICATIONS).doc(id).delete();
  return true;
}

export async function markAllNotificationsRead(tenantId: string): Promise<number> {
  const unread = (await listNotifications(tenantId, 200)).filter((item) => !item.read);
  const db = getAdminDb();
  const batch = db.batch();
  for (const item of unread) {
    batch.set(
      db.collection(NOTIFICATIONS).doc(item.id),
      { read: true, updatedAtMs: Date.now() },
      { merge: true },
    );
    if (item.deliveryId) {
      batch.update(db.collection(DELIVERIES).doc(item.deliveryId), {
        "channels.inApp.read": true,
        updatedAtMs: Date.now(),
      });
    }
  }
  if (unread.length) await batch.commit();
  return unread.length;
}

export async function unreadNotificationCount(tenantId: string): Promise<number> {
  const items = await listNotifications(tenantId, 80);
  return items.filter((item) => !item.read).length;
}
