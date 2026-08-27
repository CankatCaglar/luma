import type { JobTag } from "@/types";

const ASANA_TAG_TONES: Record<string, { bg: string; fg: string }> = {
  "dark-pink": { bg: "#e362e3", fg: "#ffffff" },
  "dark-green": { bg: "#37c35c", fg: "#ffffff" },
  "dark-blue": { bg: "#4186e0", fg: "#ffffff" },
  "dark-red": { bg: "#e8384f", fg: "#ffffff" },
  "dark-teal": { bg: "#20aaea", fg: "#ffffff" },
  "dark-brown": { bg: "#ad6200", fg: "#ffffff" },
  "dark-orange": { bg: "#fd612c", fg: "#ffffff" },
  "dark-purple": { bg: "#7a6ff0", fg: "#ffffff" },
  "dark-warm-gray": { bg: "#6d6e6f", fg: "#ffffff" },
  "light-pink": { bg: "#f8c4e8", fg: "#8a245f" },
  "light-green": { bg: "#c4efc9", fg: "#1f6b32" },
  "light-blue": { bg: "#c5def8", fg: "#1a4d8c" },
  "light-red": { bg: "#f5c1c1", fg: "#8b1a1a" },
  "light-teal": { bg: "#c3eaf8", fg: "#0d5a7a" },
  "light-yellow": { bg: "#fde8a0", fg: "#7a5b00" },
  "light-orange": { bg: "#ffd8b1", fg: "#8a4b16" },
  "light-purple": { bg: "#ddd0f7", fg: "#4b2d8a" },
  "light-warm-gray": { bg: "#e0dcd3", fg: "#4a453e" },
  red: { bg: "#e8384f", fg: "#ffffff" },
  orange: { bg: "#fd612c", fg: "#ffffff" },
  "yellow-orange": { bg: "#fd9a00", fg: "#3f2a00" },
  yellow: { bg: "#fde047", fg: "#5b4a00" },
  "yellow-green": { bg: "#a3d977", fg: "#2d5a12" },
  green: { bg: "#37c35c", fg: "#ffffff" },
  "blue-green": { bg: "#20aaea", fg: "#ffffff" },
  aqua: { bg: "#67d4e8", fg: "#0d4a5a" },
  blue: { bg: "#4186e0", fg: "#ffffff" },
  indigo: { bg: "#6f6edc", fg: "#ffffff" },
  purple: { bg: "#aa62e3", fg: "#ffffff" },
  magenta: { bg: "#e362e3", fg: "#ffffff" },
  "hot-pink": { bg: "#f06aa7", fg: "#ffffff" },
  pink: { bg: "#f8c4e8", fg: "#8a245f" },
  "cool-gray": { bg: "#cfd4da", fg: "#3f4650" },
  none: { bg: "#eeebfb", fg: "#6f6edc" },
};

const FALLBACK_TONES = [
  { bg: "#f5c1c1", fg: "#8b1a1a" },
  { bg: "#fde8a0", fg: "#7a5b00" },
  { bg: "#c5def8", fg: "#1a4d8c" },
  { bg: "#ddd0f7", fg: "#4b2d8a" },
  { bg: "#c4efc9", fg: "#1f6b32" },
  { bg: "#ffd8b1", fg: "#8a4b16" },
];

function toneFor(tag: JobTag): { bg: string; fg: string } {
  const key = tag.color?.trim().toLowerCase();
  if (key && ASANA_TAG_TONES[key]) return ASANA_TAG_TONES[key];

  let hash = 0;
  for (const char of tag.name) hash = (hash + char.charCodeAt(0)) % FALLBACK_TONES.length;
  return FALLBACK_TONES[hash] ?? FALLBACK_TONES[0];
}

export function TagBadge({ tag }: { tag: JobTag }) {
  const tone = toneFor(tag);
  return (
    <span
      className="inline-flex max-w-[9.5rem] truncate rounded-full px-2 py-0.5 text-[10px] font-semibold leading-4"
      style={{ backgroundColor: tone.bg, color: tone.fg }}
    >
      {tag.name}
    </span>
  );
}

export function TagList({ tags }: { tags?: JobTag[] }) {
  if (!tags?.length) return null;

  const visible = tags.slice(0, 3);
  const extra = tags.length - visible.length;

  return (
    <span className="flex min-w-0 flex-wrap items-center gap-1">
      {visible.map((tag) => (
        <TagBadge key={tag.id} tag={tag} />
      ))}
      {extra > 0 ? (
        <span className="inline-flex rounded-full bg-luma-border px-2 py-0.5 text-[10px] font-semibold leading-4 text-luma-muted">
          +{extra}
        </span>
      ) : null}
    </span>
  );
}
