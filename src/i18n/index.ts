import en from "./messages/en.json";
import tr from "./messages/tr.json";

export const locales = ["tr", "en"] as const;
export type Locale = (typeof locales)[number];
export type Messages = typeof tr;

export const defaultLocale: Locale = "tr";
export const LOCALE_STORAGE_KEY = "nera-locale";

const dictionaries: Record<Locale, Messages> = { tr, en };

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "tr" || value === "en";
}

export function getMessages(locale: Locale = defaultLocale): Messages {
  return dictionaries[locale];
}

type NestedKeyOf<T> = T extends object
  ? {
      [K in keyof T & string]: T[K] extends object
        ? `${K}.${NestedKeyOf<T[K]>}`
        : K;
    }[keyof T & string]
  : never;

export type MessageKey = NestedKeyOf<Messages>;

function lookup(messages: Messages, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in acc) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, messages);

  return typeof value === "string" ? value : undefined;
}

export function t(
  messages: Messages,
  key: MessageKey,
  vars?: Record<string, string | number>,
): string {
  const template = lookup(messages, key) ?? key;
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}
