import type { Job } from "@/types";
import type { Locale } from "@/i18n";
import { formatDueDate } from "@/lib/format";

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`;
  }
  return value;
}

export function buildCompletedCsv(
  jobs: Job[],
  brandName: string,
  kindLabel: (kind: Job["kind"]) => string,
  locale: Locale,
): string {
  const header =
    locale === "tr"
      ? ["Başlık", "Tür", "Tamamlanma tarihi", "Marka"]
      : ["Title", "Type", "Completed date", "Brand"];

  const rows = jobs.map((job) => [
    csvCell(job.title),
    csvCell(kindLabel(job.kind)),
    csvCell(job.completedAt ? formatDueDate(job.completedAt, locale) : ""),
    csvCell(brandName),
  ]);

  return `\uFEFF${[header.join(","), ...rows.map((row) => row.join(","))].join("\n")}`;
}

export function buildCompletedTxt(input: {
  jobs: Job[];
  brandName: string;
  periodLabel: string;
  generatedLabel: string;
  title: string;
  locale: Locale;
}): string {
  const lines = [
    `${input.brandName} — ${input.title}`,
    input.periodLabel,
    input.generatedLabel,
    "",
    ...input.jobs.map((job, index) => {
      const date = job.completedAt
        ? formatDueDate(job.completedAt, input.locale)
        : "";
      return `${index + 1}. ${job.title} — ${date}`;
    }),
  ];

  return `${lines.join("\n")}\n`;
}

export function downloadTextFile(
  filename: string,
  content: string,
  mime: string,
): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function reportFilename(
  brandId: string,
  months: number,
  extension: "csv" | "txt",
): string {
  return `${brandId}-tamamlanan-isler-son-${months}-ay.${extension}`;
}
