import { readFileSync } from "node:fs";
import { JWT } from "google-auth-library";

const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.readonly";
const FILES_URL = "https://www.googleapis.com/drive/v3/files";
const ABOUT_URL = "https://www.googleapis.com/drive/v3/about";
const FILE_FIELDS =
  "id,name,mimeType,webViewLink,webContentLink,size,modifiedTime,imageMediaMetadata(width,height),shortcutDetails(targetId,targetMimeType)";

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
};

export type DriveCredentialSource = "drive_json" | "drive_file" | "firebase_admin";

type LoadedServiceAccount = ServiceAccountJson & {
  source: DriveCredentialSource;
};

export type DriveFile = {
  id: string;
  name: string;
  mimeType: string;
  webViewLink?: string;
  webContentLink?: string;
  size?: string;
  width?: number;
  height?: number;
  modifiedTime?: string;
  shortcutTargetId?: string;
  shortcutTargetMimeType?: string;
};

export class DriveApiError extends Error {
  constructor(
    message: string,
    readonly status = 500,
  ) {
    super(message);
    this.name = "DriveApiError";
  }
}

type TokenCache = {
  token: string;
  expiresAt: number;
};

let tokenCache: TokenCache | null = null;
let jwtClient: JWT | null = null;

function parseServiceAccountJson(raw: string): ServiceAccountJson | null {
  try {
    const parsed = JSON.parse(raw) as {
      client_email?: string;
      private_key?: string;
    };
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email.trim(),
      private_key: parsed.private_key.replaceAll("\\n", "\n"),
    };
  } catch {
    return null;
  }
}

function readServiceAccount(): LoadedServiceAccount | null {
  const json = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON?.trim();
  if (json) {
    const parsed = parseServiceAccountJson(json);
    if (parsed) return { ...parsed, source: "drive_json" };
  }

  const filePath = process.env.GOOGLE_DRIVE_SERVICE_ACCOUNT_FILE?.trim();
  if (filePath) {
    try {
      const parsed = parseServiceAccountJson(readFileSync(filePath, "utf8"));
      if (parsed) return { ...parsed, source: "drive_file" };
    } catch {
      /* missing file */
    }
  }

  const firebaseJson = process.env.FIREBASE_ADMIN_CREDENTIALS_JSON?.trim();
  if (firebaseJson) {
    const parsed = parseServiceAccountJson(firebaseJson);
    if (parsed) return { ...parsed, source: "firebase_admin" };
  }

  const email = process.env.FIREBASE_ADMIN_CLIENT_EMAIL?.trim();
  const key = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.trim();
  if (email && key) {
    const unquoted =
      (key.startsWith("\"") && key.endsWith("\"")) ||
      (key.startsWith("'") && key.endsWith("'"))
        ? key.slice(1, -1)
        : key;
    return {
      client_email: email,
      private_key: unquoted.replaceAll("\\n", "\n"),
      source: "firebase_admin",
    };
  }

  return null;
}

export function isDriveConfigured(): boolean {
  return Boolean(readServiceAccount());
}

export function getDriveServiceAccountEmail(): string | undefined {
  return readServiceAccount()?.client_email;
}

function getJwt(): JWT {
  if (jwtClient) return jwtClient;
  const credentials = readServiceAccount();
  if (!credentials?.client_email || !credentials.private_key) {
    throw new DriveApiError("Drive service account is not set", 503);
  }
  jwtClient = new JWT({
    email: credentials.client_email,
    key: credentials.private_key,
    scopes: [DRIVE_SCOPE],
  });
  return jwtClient;
}

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.expiresAt - 60_000 > Date.now()) {
    return tokenCache.token;
  }
  const auth = getJwt();
  const token = await auth.getAccessToken();
  const value = typeof token === "string" ? token : token?.token;
  if (!value) {
    throw new DriveApiError("Drive access token alınamadı", 502);
  }
  tokenCache = {
    token: value,
    expiresAt: Date.now() + 50 * 60 * 1000,
  };
  return value;
}

async function driveFetch(url: string): Promise<Response> {
  const token = await getAccessToken();
  return fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

function asDriveFile(input: unknown): DriveFile | null {
  if (!input || typeof input !== "object") return null;
  const raw = input as {
    id?: string;
    name?: string;
    mimeType?: string;
    webViewLink?: string;
    webContentLink?: string;
    size?: string;
    modifiedTime?: string;
    imageMediaMetadata?: { width?: number; height?: number };
    shortcutDetails?: { targetId?: string; targetMimeType?: string };
  };
  if (!raw.id || !raw.name) return null;
  return {
    id: raw.id,
    name: raw.name,
    mimeType: raw.mimeType ?? "application/octet-stream",
    webViewLink: raw.webViewLink,
    webContentLink: raw.webContentLink,
    size: raw.size,
    width: raw.imageMediaMetadata?.width,
    height: raw.imageMediaMetadata?.height,
    modifiedTime: raw.modifiedTime,
    shortcutTargetId: raw.shortcutDetails?.targetId,
    shortcutTargetMimeType: raw.shortcutDetails?.targetMimeType,
  };
}

export async function getDriveFile(fileId: string): Promise<DriveFile> {
  const id = fileId.trim();
  if (!id) throw new DriveApiError("Drive dosya id'si eksik", 400);
  const url = new URL(`${FILES_URL}/${encodeURIComponent(id)}`);
  url.searchParams.set("fields", FILE_FIELDS);
  url.searchParams.set("supportsAllDrives", "true");

  const response = await driveFetch(url.toString());
  const payload = (await response.json().catch(() => null)) as {
    error?: { message?: string };
    id?: string;
    name?: string;
    mimeType?: string;
    webViewLink?: string;
    webContentLink?: string;
    size?: string;
    modifiedTime?: string;
    shortcutDetails?: { targetId?: string; targetMimeType?: string };
  } | null;
  if (!response.ok) {
    throw new DriveApiError(payload?.error?.message || "Drive dosyası okunamadı", response.status);
  }
  const file = asDriveFile(payload);
  if (!file) throw new DriveApiError("Drive dosyası çözülemedi", 502);
  return file;
}

export async function listDriveChildren(folderId: string): Promise<DriveFile[]> {
  const id = folderId.trim();
  if (!id) return [];

  const files: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const url = new URL(FILES_URL);
    url.searchParams.set("q", `'${id.replaceAll("'", "\\'")}' in parents and trashed = false`);
    url.searchParams.set("fields", `nextPageToken,files(${FILE_FIELDS})`);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("supportsAllDrives", "true");
    url.searchParams.set("includeItemsFromAllDrives", "true");
    url.searchParams.set("orderBy", "modifiedTime desc");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const response = await driveFetch(url.toString());
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      files?: unknown[];
      nextPageToken?: string;
    } | null;
    if (!response.ok) {
      throw new DriveApiError(
        payload?.error?.message || "Drive klasörü listelenemedi",
        response.status,
      );
    }
    for (const item of payload?.files ?? []) {
      const file = asDriveFile(item);
      if (file) files.push(file);
    }
    pageToken = payload?.nextPageToken;
  } while (pageToken);

  return files;
}

export type DriveProbe = {
  ok: boolean;
  id?: string;
  name?: string;
  mimeType?: string;
  error?: string;
};

export type DriveRuntimeStatus = {
  configured: boolean;
  email?: string;
  source?: DriveCredentialSource;
  apiOk: boolean;
  error?: string;
};

export async function getDriveRuntimeStatus(): Promise<DriveRuntimeStatus> {
  const credentials = readServiceAccount();
  if (!credentials) {
    return {
      configured: false,
      apiOk: false,
      error: "Service account yok. Firebase Admin veya GOOGLE_DRIVE_SERVICE_ACCOUNT_JSON ekle.",
    };
  }

  try {
    const url = new URL(ABOUT_URL);
    url.searchParams.set("fields", "user(emailAddress)");
    const response = await driveFetch(url.toString());
    const payload = (await response.json().catch(() => null)) as {
      error?: { message?: string };
      user?: { emailAddress?: string };
    } | null;
    if (!response.ok) {
      return {
        configured: true,
        email: credentials.client_email,
        source: credentials.source,
        apiOk: false,
        error:
          payload?.error?.message ||
          "Drive API yanıt vermedi. Google Cloud'da Drive API açık mı?",
      };
    }
    return {
      configured: true,
      email: payload?.user?.emailAddress || credentials.client_email,
      source: credentials.source,
      apiOk: true,
    };
  } catch (error) {
    return {
      configured: true,
      email: credentials.client_email,
      source: credentials.source,
      apiOk: false,
      error: error instanceof Error ? error.message : "Drive API kontrolü başarısız",
    };
  }
}

export async function probeDriveFolder(folderId: string | undefined): Promise<DriveProbe> {
  const id = folderId?.trim();
  if (!id) return { ok: false, error: "Klasör linki yok" };
  if (!isDriveConfigured()) {
    return { ok: false, id, error: "Drive API yapılandırılmadı" };
  }
  try {
    const file = await getDriveFile(id);
    return {
      ok: true,
      id: file.id,
      name: file.name,
      mimeType: file.mimeType,
    };
  } catch (error) {
    return {
      ok: false,
      id,
      error: error instanceof Error ? error.message : "Drive klasörüne erişilemedi",
    };
  }
}
