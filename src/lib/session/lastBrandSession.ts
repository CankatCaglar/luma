export type LastBrandSession = {
  uid: string;
  isAdmin: boolean;
  brandName?: string;
};

const STORAGE_KEY = "luma-last-session-v1";
const listeners = new Set<() => void>();

let cachedRaw: string | null = null;
let cachedValue: LastBrandSession | null = null;
let hasCache = false;

function canUseStorage() {
  return typeof window !== "undefined";
}

function parseSession(raw: string | null): LastBrandSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<LastBrandSession>;
    if (!parsed.uid || typeof parsed.uid !== "string") return null;
    return {
      uid: parsed.uid,
      isAdmin: Boolean(parsed.isAdmin),
      brandName:
        typeof parsed.brandName === "string" && parsed.brandName.trim()
          ? parsed.brandName.trim()
          : undefined,
    };
  } catch {
    return null;
  }
}

export function readLastBrandSession(): LastBrandSession | null {
  if (!canUseStorage()) return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (hasCache && raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  cachedValue = parseSession(raw);
  hasCache = true;
  return cachedValue;
}

export function writeLastBrandSession(session: LastBrandSession | null) {
  if (!canUseStorage()) return;
  const nextRaw = session ? JSON.stringify(session) : null;
  if (hasCache && nextRaw === cachedRaw) return;
  try {
    if (!session || nextRaw === null) window.localStorage.removeItem(STORAGE_KEY);
    else window.localStorage.setItem(STORAGE_KEY, nextRaw);
  } catch {
    /* quota / private mode */
  }
  cachedRaw = nextRaw;
  cachedValue = session;
  hasCache = true;
  listeners.forEach((listener) => listener());
}

export function subscribeLastBrandSession(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
