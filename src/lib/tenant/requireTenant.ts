import { AuthApiError, requireVerifiedUser } from "@/lib/firebase/admin";
import {
  getTenantByEmail,
  getTenantById,
  type TenantAccess,
} from "@/lib/tenant/access";

export class TenantAccessError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TenantAccessError";
  }
}

export async function requireTenantAccess(
  request: Request,
): Promise<{ user: { uid: string; email: string }; tenant: TenantAccess }> {
  let user;
  try {
    user = await requireVerifiedUser(request);
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw new TenantAccessError(error.message, error.status);
    }
    throw new TenantAccessError("Unauthorized", 401);
  }

  const tokenTenantId =
    typeof user.token.tenantId === "string" ? user.token.tenantId : null;
  const email = user.email.toLowerCase();
  const claimed =
    tokenTenantId ? await getTenantById(tokenTenantId) : null;
  const tenant =
    claimed && claimed.emails.includes(email)
      ? claimed
      : await getTenantByEmail(email);
  if (!tenant || !tenant.emails.includes(email)) {
    throw new TenantAccessError("User is not allowed for this tenant", 403);
  }

  return { user, tenant };
}
