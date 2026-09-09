import { NextResponse } from "next/server";
import {
  isValidPortalUsername,
  normalizePortalUsername,
  portalEmailFromUsername,
} from "@/lib/auth/portalLogin";
import { getTenantByEmail, getTenantByPortalUsername } from "@/lib/tenant/access";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as { username?: string } | null;
    const raw = body?.username?.trim() ?? "";
    if (!raw) {
      return NextResponse.json({ error: "Kullanıcı adı gerekli" }, { status: 400 });
    }

    if (raw.includes("@")) {
      const tenant = await getTenantByEmail(raw);
      return NextResponse.json({
        email: tenant?.emails[0] ?? raw.trim().toLowerCase(),
      });
    }

    const username = normalizePortalUsername(raw);
    if (!isValidPortalUsername(username)) {
      return NextResponse.json({ email: portalEmailFromUsername(username) });
    }

    const tenant = await getTenantByPortalUsername(username);
    return NextResponse.json({
      email: tenant?.emails[0] ?? portalEmailFromUsername(username),
    });
  } catch {
    return NextResponse.json({ error: "Giriş bilgisi çözülemedi" }, { status: 500 });
  }
}
