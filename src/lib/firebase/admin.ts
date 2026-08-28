import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth, type DecodedIdToken } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

type AdminCredential = {
  projectId: string;
  clientEmail: string;
  privateKey: string;
};

function readEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function normalizePrivateKey(value: string): string {
  const unquoted =
    (value.startsWith("\"") && value.endsWith("\"")) ||
    (value.startsWith("'") && value.endsWith("'"))
      ? value.slice(1, -1)
      : value;
  return unquoted
    .replaceAll("\\n", "\n")
    .replaceAll("\\r\\n", "\n")
    .replaceAll("\r\n", "\n");
}

function readCredentialFromJson(): AdminCredential | null {
  const raw = readEnv("FIREBASE_ADMIN_CREDENTIALS_JSON");
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<{
      project_id: string;
      client_email: string;
      private_key: string;
      projectId: string;
      clientEmail: string;
      privateKey: string;
    }>;
    const projectId = parsed.project_id ?? parsed.projectId;
    const clientEmail = parsed.client_email ?? parsed.clientEmail;
    const privateKey = parsed.private_key ?? parsed.privateKey;
    if (!projectId || !clientEmail || !privateKey) return null;
    return {
      projectId,
      clientEmail,
      privateKey: normalizePrivateKey(privateKey),
    };
  } catch {
    return null;
  }
}

function readCredentialFromParts(): AdminCredential | null {
  const projectId = readEnv("FIREBASE_ADMIN_PROJECT_ID");
  const clientEmail = readEnv("FIREBASE_ADMIN_CLIENT_EMAIL");
  const privateKey = readEnv("FIREBASE_ADMIN_PRIVATE_KEY");
  if (!projectId || !clientEmail || !privateKey) return null;
  return {
    projectId,
    clientEmail,
    privateKey: normalizePrivateKey(privateKey),
  };
}

function readCredential(): AdminCredential | null {
  return readCredentialFromJson() ?? readCredentialFromParts();
}

let adminApp: ReturnType<typeof initializeApp> | null | undefined;
let adminInitError: Error | null = null;

function ensureAdminApp() {
  if (adminApp !== undefined) return adminApp;
  const adminCredential = readCredential();
  if (!adminCredential) {
    adminApp = null;
    return adminApp;
  }
  try {
    adminApp =
      getApps()[0] ??
      initializeApp({
        credential: cert(adminCredential),
        projectId: adminCredential.projectId,
      });
  } catch (error) {
    adminInitError =
      error instanceof Error ? error : new Error("Firebase admin init failed");
    adminApp = null;
  }
  return adminApp;
}

export type VerifiedUser = {
  uid: string;
  email: string;
  emailVerified: boolean;
  token: DecodedIdToken;
};

export class AuthApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

function readBearerToken(request: Request): string {
  const header = request.headers.get("authorization") ?? "";
  if (!header.startsWith("Bearer ")) {
    throw new AuthApiError("Missing bearer token", 401);
  }
  return header.slice("Bearer ".length).trim();
}

export async function requireVerifiedUser(request: Request): Promise<VerifiedUser> {
  const adminAuth = getAdminAuth();
  if (!adminAuth) {
    throw new AuthApiError("Firebase admin credentials are missing", 503);
  }
  const token = readBearerToken(request);

  let decoded;
  try {
    decoded = await adminAuth.verifyIdToken(token, true);
  } catch {
    throw new AuthApiError("Invalid or expired token", 401);
  }

  const email = decoded.email?.toLowerCase().trim();
  if (!email) {
    throw new AuthApiError("User email is not available", 403);
  }

  return {
    uid: decoded.uid,
    email,
    emailVerified: Boolean(decoded.email_verified),
    token: decoded,
  };
}

export async function requireVerifiedUserEmail(request: Request): Promise<{
  uid: string;
  email: string;
}> {
  const user = await requireVerifiedUser(request);
  return { uid: user.uid, email: user.email };
}

function readCsv(name: string): string[] {
  const value = readEnv(name);
  if (!value) return [];
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
}

export function isAdminUser(user: VerifiedUser): boolean {
  const roleClaim = user.token.role;
  if (roleClaim === "admin" || roleClaim === "owner") return true;
  const admins = readCsv("ADMIN_USER_EMAILS");
  return admins.includes(user.email.toLowerCase());
}

export function getAdminAuth() {
  const app = ensureAdminApp();
  if (!app) {
    const detail = adminInitError
      ? ` (${adminInitError.message})`
      : "";
    throw new AuthApiError(
      `Firebase admin credentials are missing or invalid${detail}`,
      503,
    );
  }
  return getAuth(app);
}

export function getAdminDb() {
  const app = ensureAdminApp();
  if (!app) {
    const detail = adminInitError
      ? ` (${adminInitError.message})`
      : "";
    throw new AuthApiError(
      `Firebase admin credentials are missing or invalid${detail}`,
      503,
    );
  }
  return getFirestore(app);
}
