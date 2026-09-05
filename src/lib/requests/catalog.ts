export const REQUEST_CATEGORIES = [
  "social",
  "design",
  "video",
  "ads",
  "web",
  "other",
] as const;

export type RequestCategory = (typeof REQUEST_CATEGORIES)[number];

export const REQUEST_SUBTYPES = {
  social: ["post", "story", "special_day"],
  design: ["brochure", "catalog", "presentation", "banner", "poster", "mailing"],
  video: ["reels", "corporate", "animation", "adaptation"],
  ads: ["meta", "google", "ad_visual"],
  web: ["web_content", "banner_change", "page_update", "popup"],
  other: [],
} as const;

export type RequestSubtype = {
  [Category in RequestCategory]: (typeof REQUEST_SUBTYPES)[Category][number];
}[RequestCategory];

export const ASANA_PRIORITY_LEVELS = ["high", "medium", "low"] as const;
export type AsanaPriorityLevel = (typeof ASANA_PRIORITY_LEVELS)[number];

export const CATEGORY_LABELS: Record<RequestCategory, string> = {
  social: "Sosyal Medya Görseli",
  design: "Tasarım / Kurumsal Materyal",
  video: "Video",
  ads: "Dijital Reklam",
  web: "Web / Dijital Güncelleme",
  other: "Diğer",
};

export const SUBTYPE_LABELS: Record<string, string> = {
  post: "Post",
  story: "Story",
  special_day: "Özel gün içeriği",
  brochure: "Broşür",
  catalog: "Katalog",
  presentation: "Sunum",
  banner: "Banner",
  poster: "Afiş",
  mailing: "Mailing tasarımı",
  reels: "Reels",
  corporate: "Kurumsal video",
  animation: "Animasyon",
  adaptation: "Video uyarlaması",
  meta: "Meta",
  google: "Google Ads",
  ad_visual: "Reklam görseli / kampanya",
  web_content: "Web sitesi içeriği",
  banner_change: "Banner değişimi",
  page_update: "Sayfa güncellemesi",
  popup: "Pop-up",
};

export const PRIORITY_LABELS: Record<AsanaPriorityLevel, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function isRequestCategory(value: string): value is RequestCategory {
  return (REQUEST_CATEGORIES as readonly string[]).includes(value);
}

export function isAsanaPriorityLevel(value: string): value is AsanaPriorityLevel {
  return (ASANA_PRIORITY_LEVELS as readonly string[]).includes(value);
}

export function subtypesFor(category: RequestCategory): readonly string[] {
  return REQUEST_SUBTYPES[category];
}

export function isSubtypeOf(category: RequestCategory, subtype: string): boolean {
  return (REQUEST_SUBTYPES[category] as readonly string[]).includes(subtype);
}

export function formatRequestType(category: RequestCategory, subtype?: string): string {
  const categoryLabel = CATEGORY_LABELS[category];
  if (!subtype) return categoryLabel;
  const subtypeLabel = SUBTYPE_LABELS[subtype] ?? subtype;
  return `${categoryLabel} · ${subtypeLabel}`;
}
