import { NextResponse } from "next/server";
import {
  emailStatusFromResendType,
  parseResendEvent,
  verifyResendWebhook,
} from "@/lib/delivery/resend";
import { findDeliveryByResendId, updateDelivery } from "@/lib/delivery/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  const raw = await request.text();
  const secret = process.env.RESEND_WEBHOOK_SECRET?.trim();
  if (!secret || !verifyResendWebhook(raw, request.headers, secret)) {
    return NextResponse.json({ error: "Invalid webhook signature" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = JSON.parse(raw) as unknown;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = parseResendEvent(payload);
  if (!event?.emailId) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const status = emailStatusFromResendType(event.type);
  if (!status) {
    return NextResponse.json({ ok: true, ignored: true });
  }

  const delivery = await findDeliveryByResendId(event.emailId);
  if (!delivery) {
    return NextResponse.json({ ok: true, missing: true });
  }

  await updateDelivery(delivery.id, {
    "channels.email.status": status,
  });

  return NextResponse.json({ ok: true, id: delivery.id, status });
}
