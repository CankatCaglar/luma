import { NextResponse } from "next/server";
import {
  DriveApiError,
  isDriveFileUnderFolder,
  streamDriveDownload,
} from "@/lib/drive/client";
import { parseDriveResourceId } from "@/lib/drive/parse";
import { readJobSnapshot } from "@/lib/data/jobSnapshot";
import {
  TenantAccessError,
  requireTenantAccess,
} from "@/lib/tenant/requireTenant";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7E]+/g, "_") || "file";
  const encoded = encodeURIComponent(filename);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

async function isKnownBrandFile(tenantId: string, fileId: string): Promise<boolean> {
  const snapshot = await readJobSnapshot(tenantId);
  return Boolean(
    snapshot?.brandAssets?.some((asset) => asset.files?.some((file) => file.id === fileId)),
  );
}

export async function GET(request: Request) {
  try {
    const { tenant } = await requireTenantAccess(request);
    const fileId = parseDriveResourceId(
      new URL(request.url).searchParams.get("fileId") ?? "",
    );
    if (!fileId) {
      return NextResponse.json({ error: "Dosya id'si eksik" }, { status: 400 });
    }

    const rootId = tenant.drive?.rootFolderId;
    if (!rootId) {
      return NextResponse.json({ error: "Drive kutusu bağlı değil" }, { status: 403 });
    }

    const known = await isKnownBrandFile(tenant.tenantId, fileId);
    const allowed = known || (await isDriveFileUnderFolder(fileId, rootId));
    if (!allowed) {
      return NextResponse.json({ error: "Bu dosyayı indirme yetkiniz yok" }, { status: 403 });
    }

    const download = await streamDriveDownload(fileId);
    return new NextResponse(download.body, {
      headers: {
        "Content-Type": download.contentType,
        "Content-Disposition": contentDisposition(download.filename),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    if (error instanceof TenantAccessError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof DriveApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Dosya indirilemedi";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
