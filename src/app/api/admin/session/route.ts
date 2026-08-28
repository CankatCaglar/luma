import { NextResponse } from "next/server";
import { AuthApiError, isAdminUser, requireVerifiedUser } from "@/lib/firebase/admin";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireVerifiedUser(request);
    return NextResponse.json({
      isAdmin: isAdminUser(user),
      email: user.email,
    });
  } catch (error) {
    if (error instanceof AuthApiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    const message = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: message }, { status: 401 });
  }
}
