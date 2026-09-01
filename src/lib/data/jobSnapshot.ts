import { getAdminDb } from "@/lib/firebase/admin";
import {
  compactJobLists,
  expandJobLists,
  type CompactJobLists,
} from "@/lib/data/jobLists";
import type { JobLists } from "@/types";

const COLLECTION = "jobSnapshots";
const MAX_DOC_BYTES = 900_000;

export type StoredJobSnapshot = CompactJobLists & {
  fetchedAt: number;
};

function collection() {
  return getAdminDb().collection(COLLECTION);
}

function asPlain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export async function readJobSnapshot(tenantId: string): Promise<StoredJobSnapshot | null> {
  const id = tenantId.trim();
  if (!id) return null;
  try {
    const snap = await collection().doc(id).get();
    if (!snap.exists) return null;
    const data = snap.data() as Partial<StoredJobSnapshot> | undefined;
    if (!data || !Array.isArray(data.jobs) || !data.tenant || !data.fetchedAt) {
      return null;
    }
    return {
      tenant: data.tenant,
      source: data.source === "mock" ? "mock" : "asana",
      jobs: data.jobs,
      referenceNowIso: data.referenceNowIso ?? new Date(data.fetchedAt).toISOString(),
      fetchedAt: data.fetchedAt,
      brandAssets: data.brandAssets,
      driveBoxUrl: data.driveBoxUrl,
      plansFolderUrl: data.plansFolderUrl,
      plansFolderTitle: data.plansFolderTitle,
      planYears: data.planYears,
      contentPlans: data.contentPlans,
      partial: data.partial,
    };
  } catch {
    return null;
  }
}

export async function writeJobSnapshot(tenantId: string, data: JobLists): Promise<void> {
  const id = tenantId.trim();
  if (!id || data.source !== "asana") return;
  const payload = asPlain({
    ...compactJobLists(data),
    fetchedAt: Date.now(),
  });
  const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  if (bytes > MAX_DOC_BYTES) return;
  try {
    await collection().doc(id).set(payload, { merge: true });
  } catch {
    /* quota / rules / credentials */
  }
}

export function snapshotToJobLists(snapshot: StoredJobSnapshot): JobLists | null {
  return expandJobLists(snapshot);
}
