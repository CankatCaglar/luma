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
      privateKey: privateKey.replaceAll("\\n", "\n"),
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
    privateKey: privateKey.replaceAll("\\n", "\n"),
  };
}

function readCredential(): AdminCredential | null {
  return readCredentialFromJson() ?? readCredentialFromParts();
}

const adminCredential = readCredential();

const adminApp = adminCredential
  ? getApps()[0] ??
    initializeApp({
      credential: cert(adminCredential),
      projectId: adminCredential.projectId,
    })
  : null;

const adminAuth = adminApp ? getAuth(adminApp) : null;
const adminDb = adminApp ? getFirestore(adminApp) : null;

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
  if (!adminAuth) throw new AuthApiError("Firebase admin credentials are missing", 503);
  return adminAuth;
}

export function getAdminDb() {
  if (!adminDb) throw new AuthApiError("Firebase admin credentials are missing", 503);
  return adminDb;
}
