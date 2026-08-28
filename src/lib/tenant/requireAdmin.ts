import {
  AuthApiError,
  isAdminUser,
  requireVerifiedUser,
} from "@/lib/firebase/admin";
import { TenantAccessError } from "@/lib/tenant/requireTenant";

export async function requireAdminAccess(
  request: Request,
): Promise<{ uid: string; email: string }> {
  let user;
  try {
    user = await requireVerifiedUser(request);
  } catch (error) {
    if (error instanceof AuthApiError) {
      throw new TenantAccessError(error.message, error.status);
    }
    throw new TenantAccessError("Unauthorized", 401);
  }

  if (!isAdminUser(user)) {
    throw new TenantAccessError("Admin access required", 403);
  }

  return {
    uid: user.uid,
    email: user.email,
  };
}
