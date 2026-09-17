import { getBrandTasks, getTaskResources } from "@/lib/asana/client";
import { getAsanaEnv } from "@/lib/asana/config";
import {
  extractResourceUrl,
  mapTaskKind,
  parseMonthKey,
  taskSectionName,
  displayTaskTitle,
} from "@/lib/asana/map";
import { classifyDeliveryEvent } from "@/lib/delivery/events";
import { sendDelivery } from "@/lib/delivery/send";
import { readTaskStates, writeTaskStates } from "@/lib/delivery/taskState";
import type { DeliveryRecord } from "@/lib/delivery/types";
import {
  listTenantDirectory,
  type TenantAccess,
} from "@/lib/tenant/access";

export type ScanSummary = {
  tenants: number;
  transitions: number;
  sent: number;
  skipped: number;
  errors: string[];
};

function customerLinkFromTask(
  htmlNotes: string | undefined,
  attachments: Parameters<typeof extractResourceUrl>[1],
  kind: ReturnType<typeof mapTaskKind>,
): string | undefined {
  return extractResourceUrl(htmlNotes, attachments, kind);
}

export async function scanTenantDeliveries(
  tenant: TenantAccess,
): Promise<{ sent: DeliveryRecord[]; transitions: number; error?: string }> {
  if (!tenant.asana.projectGids.length || !tenant.asana.brandCode) {
    return { sent: [], transitions: 0 };
  }

  const env = getAsanaEnv();
  const tasks = await getBrandTasks({
    projectGids: tenant.asana.projectGids,
    brandCode: tenant.asana.brandCode,
    workspaceGid: tenant.asana.workspaceGid || env.workspaceGid,
    skipCache: true,
    completedSince: "now",
  });

  const previous = await readTaskStates(tenant.tenantId);
  const next: Record<string, { section: string; name?: string }> = {};
  const pending: Array<{
    taskGid: string;
    fromSection: string;
    toSection: string;
    name: string;
    kind: ReturnType<typeof mapTaskKind>;
  }> = [];

  for (const task of tasks) {
    if (task.completed) continue;
    const section =
      taskSectionName(task, tenant.asana.projectGids[0]) ??
      task.memberships?.[0]?.section?.name ??
      "";
    next[task.gid] = { section, name: task.name };
    const prevSection = previous[task.gid]?.section;
    if (prevSection === undefined || prevSection === section) continue;
    const kind = mapTaskKind(task, { brandCode: tenant.asana.brandCode });
    const eventType = classifyDeliveryEvent({
      fromSection: prevSection,
      toSection: section,
      taskName: task.name,
      kind,
    });
    if (!eventType) continue;
    pending.push({
      taskGid: task.gid,
      fromSection: prevSection,
      toSection: section,
      name: task.name,
      kind,
    });
  }

  await writeTaskStates(tenant.tenantId, next);
  if (!pending.length) return { sent: [], transitions: 0 };

  const details = await getTaskResources(pending.map((item) => item.taskGid));
  const sent: DeliveryRecord[] = [];

  for (const item of pending) {
    const eventType = classifyDeliveryEvent({
      fromSection: item.fromSection,
      toSection: item.toSection,
      taskName: item.name,
      kind: item.kind,
    });
    if (!eventType) continue;
    const extra = details.get(item.taskGid);
    const title = displayTaskTitle(item.name, tenant.asana.brandCode) || item.name;
    const monthKey = parseMonthKey(title, new Date().toISOString().slice(0, 10));
    const customerLink = customerLinkFromTask(
      extra?.html_notes,
      extra?.attachments,
      item.kind,
    );
    const record = await sendDelivery({
      tenant,
      eventType,
      taskTitle: title,
      taskGid: item.taskGid,
      customerLink,
      monthKey,
      fromSection: item.fromSection,
      toSection: item.toSection,
      source: "auto",
    });
    sent.push(record);
  }

  return { sent, transitions: pending.length };
}

export async function scanAllTenantDeliveries(): Promise<ScanSummary> {
  const tenants = await listTenantDirectory();
  const summary: ScanSummary = {
    tenants: tenants.length,
    transitions: 0,
    sent: 0,
    skipped: 0,
    errors: [],
  };

  for (const tenant of tenants) {
    try {
      const result = await scanTenantDeliveries(tenant);
      summary.transitions += result.transitions;
      summary.sent += result.sent.length;
      summary.skipped += Math.max(0, result.transitions - result.sent.length);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Bilinmeyen hata";
      summary.errors.push(`${tenant.brandName}: ${message}`);
    }
  }

  return summary;
}
