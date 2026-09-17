import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebase/admin";

export type TaskSectionState = {
  section: string;
  name?: string;
};

export type TenantTaskState = {
  tasks: Record<string, TaskSectionState>;
  scannedAt: number;
};

const COLLECTION = "taskStates";

export async function readTaskStates(
  tenantId: string,
): Promise<Record<string, TaskSectionState>> {
  try {
    const snap = await getAdminDb().collection(COLLECTION).doc(tenantId).get();
    const data = snap.data() as { tasks?: Record<string, TaskSectionState> } | undefined;
    return data?.tasks && typeof data.tasks === "object" ? data.tasks : {};
  } catch {
    return {};
  }
}

export async function writeTaskStates(
  tenantId: string,
  tasks: Record<string, TaskSectionState>,
): Promise<void> {
  await getAdminDb()
    .collection(COLLECTION)
    .doc(tenantId)
    .set({
      tasks,
      scannedAt: Date.now(),
      updatedAt: FieldValue.serverTimestamp(),
    });
}
