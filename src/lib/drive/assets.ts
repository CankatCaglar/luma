import { foldLabel } from "@/lib/asana/map";
import { preferDriveUrl, type TenantDriveConfig } from "@/lib/drive/parse";
import type { DrivePlansCatalog } from "@/lib/drive/plans";
import type { BrandAsset, Job } from "@/types";

export function brandAssetsFromDrive(
  drive: TenantDriveConfig | undefined,
  discovered?: Pick<
    DrivePlansCatalog,
    | "logoUrl"
    | "briefUrl"
    | "competitorUrl"
    | "logoFiles"
    | "briefFiles"
    | "competitorFiles"
  >,
): BrandAsset[] {
  if (!drive) return [];
  const assets: BrandAsset[] = [];
  const boxUrl = preferDriveUrl(drive.rootUrl, drive.rootFolderId);
  if (boxUrl) {
    assets.push({
      id: "asset-box",
      nameKey: "brandCenter.box",
      descriptionKey: "brandCenter.boxDescription",
      kind: "box",
      url: boxUrl,
    });
  }
  const logoUrl = drive.logoUrl || discovered?.logoUrl;
  const logoFiles = discovered?.logoFiles ?? [];
  if (logoUrl || logoFiles.length) {
    assets.push({
      id: "asset-logo",
      nameKey: "brandCenter.logo",
      descriptionKey: "brandCenter.logoDescription",
      kind: "logo",
      url: logoUrl || logoFiles[0].viewUrl,
      files: logoFiles,
    });
  }
  const briefUrl = drive.briefUrl || discovered?.briefUrl;
  const briefFiles = discovered?.briefFiles ?? [];
  if (briefUrl || briefFiles.length) {
    assets.push({
      id: "asset-brief",
      nameKey: "brandCenter.brief",
      descriptionKey: "brandCenter.briefDescription",
      kind: "brief",
      url: briefUrl || briefFiles[0].viewUrl,
      files: briefFiles,
    });
  }
  const competitorUrl = drive.competitorUrl || discovered?.competitorUrl;
  const competitorFiles = discovered?.competitorFiles ?? [];
  if (competitorUrl || competitorFiles.length) {
    assets.push({
      id: "asset-competitor",
      nameKey: "brandCenter.competitor",
      descriptionKey: "brandCenter.competitorDescription",
      kind: "competitor",
      url: competitorUrl || competitorFiles[0].viewUrl,
      files: competitorFiles,
    });
  }
  return assets;
}

export function applyCompetitorOverlay(jobs: Job[], competitorUrl: string | undefined): Job[] {
  const url = competitorUrl?.trim();
  if (!url) return jobs;
  return jobs.map((job) => {
    if (job.resourceUrl) return job;
    if (!foldLabel(job.title).includes("rakip analiz")) return job;
    return { ...job, resourceUrl: url };
  });
}
