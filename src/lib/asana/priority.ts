import { getProject, typeaheadTags } from "@/lib/asana/client";
import { foldLabel } from "@/lib/asana/map";
import type { AsanaPriorityLevel } from "@/lib/requests/catalog";

const TAG_ALIASES: Record<AsanaPriorityLevel, string[]> = {
  high: ["high", "yüksek", "yuksek"],
  medium: ["medium", "orta"],
  low: ["low", "düşük", "dusuk"],
};

const FIELD_ALIASES = ["priority", "oncelik", "öncelik"];

export type ResolvedAsanaPriority = {
  tagGid?: string;
  customFields?: Record<string, string>;
};

export async function resolveAsanaPriority(input: {
  workspaceGid: string;
  projectGid: string;
  level: AsanaPriorityLevel;
}): Promise<ResolvedAsanaPriority> {
  const searchNames = TAG_ALIASES[input.level];
  const [tagHits, project] = await Promise.all([
    Promise.all(searchNames.map((query) => typeaheadTags(input.workspaceGid, query).catch(() => []))).then(
      (groups) => groups.flat(),
    ),
    getProject(input.projectGid).catch(() => null),
  ]);

  const wanted = searchNames.map(foldLabel);
  const tag = tagHits.find((item) => wanted.includes(foldLabel(item.name)));

  const field = project?.custom_field_settings
    ?.map((setting) => setting.custom_field)
    .find((item) => FIELD_ALIASES.includes(foldLabel(item.name)));
  const option = field?.enum_options?.find((item) => wanted.includes(foldLabel(item.name)));

  return {
    tagGid: tag?.gid,
    customFields: field && option ? { [field.gid]: option.gid } : undefined,
  };
}
