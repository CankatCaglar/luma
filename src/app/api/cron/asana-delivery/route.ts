import { NextResponse } from "next/server";
import { scanAllTenantDeliveries } from "@/lib/delivery/scan";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorizeCron(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  const auth = request.headers.get("authorization") ?? "";
  const headerSecret = request.headers.get("x-cron-secret") ?? "";
  if (secret) {
    return auth === `Bearer ${secret}` || headerSecret === secret;
  }
  return process.env.NODE_ENV !== "production";
}

async function run(request: Request) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const summary = await scanAllTenantDeliveries();
  return NextResponse.json({ ok: true, ...summary });
}

export async function GET(request: Request) {
  return run(request);
}

export async function POST(request: Request) {
  return run(request);
}
