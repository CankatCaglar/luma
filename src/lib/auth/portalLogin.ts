export const PORTAL_LOGIN_DOMAIN = "login.luma.app";

export function normalizePortalUsername(value: string): string {
  return value.trim().toLocaleLowerCase("tr-TR").replaceAll("ı", "i");
}

export function isValidPortalUsername(value: string): boolean {
  return /^[a-z0-9][a-z0-9._-]{0,30}[a-z0-9]$|^[a-z0-9]{2}$/.test(
    normalizePortalUsername(value),
  );
}

export function portalEmailFromUsername(username: string): string {
  return `${normalizePortalUsername(username)}@${PORTAL_LOGIN_DOMAIN}`;
}

export function emailLocalPart(email: string): string {
  return email.trim().toLowerCase().split("@")[0] ?? "";
}

export function isPortalLoginEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith(`@${PORTAL_LOGIN_DOMAIN}`);
}

export function displayPortalUsername(email: string, stored?: string): string {
  const fromStore = stored?.trim();
  if (fromStore) return fromStore;
  return emailLocalPart(email);
}
