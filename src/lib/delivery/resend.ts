import { createHmac, timingSafeEqual } from "node:crypto";
import { Resend } from "resend";

const DEFAULT_FROM = "Luma by Nera <innovations@nerasocial.com>";

export function getMailFrom(): string {
  return process.env.MAIL_FROM?.trim() || DEFAULT_FROM;
}

export function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getResendClient(): Resend | null {
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return null;
  return new Resend(key);
}

export function textToHtml(text: string): string {
  const escaped = text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const withLinks = escaped.replace(
    /(https?:\/\/[^\s<]+)/g,
    '<a href="$1" style="color:#c45c26;word-break:break-all">$1</a>',
  );
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;color:#1c1917">${withLinks.replaceAll("\n", "<br />")}</div>`;
}

export async function sendPlainEmail(input: {
  to: string;
  subject: string;
  text: string;
}): Promise<{ id?: string; error?: string }> {
  const client = getResendClient();
  if (!client) {
    return { error: "RESEND_API_KEY tanımlı değil" };
  }

  const { data, error } = await client.emails.send({
    from: getMailFrom(),
    to: [input.to],
    subject: input.subject,
    text: input.text,
    html: textToHtml(input.text),
  });

  if (error) {
    return { error: error.message || "Mail gönderilemedi" };
  }
  return { id: data?.id };
}

export type ResendDomainStatus = {
  configured: boolean;
  from: string;
  domains: Array<{
    name: string;
    status: string;
    region?: string;
  }>;
  error?: string;
};

export async function getResendDomainStatus(): Promise<ResendDomainStatus> {
  const from = getMailFrom();
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) {
    return {
      configured: false,
      from,
      domains: [],
      error: "RESEND_API_KEY tanımlı değil",
    };
  }

  try {
    const response = await fetch("https://api.resend.com/domains", {
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(10_000),
    });
    const payload = (await response.json().catch(() => null)) as
      | { data?: Array<{ name?: string; status?: string; region?: string }>; message?: string }
      | null;
    if (!response.ok) {
      return {
        configured: true,
        from,
        domains: [],
        error: payload?.message ?? `Resend domain listesi alınamadı (${response.status})`,
      };
    }
    return {
      configured: true,
      from,
      domains: (payload?.data ?? []).map((domain) => ({
        name: domain.name ?? "",
        status: domain.status ?? "unknown",
        region: domain.region,
      })),
    };
  } catch (error) {
    return {
      configured: true,
      from,
      domains: [],
      error: error instanceof Error ? error.message : "Resend durumu alınamadı",
    };
  }
}

function parseWebhookSecret(secret: string): Buffer {
  const trimmed = secret.trim();
  if (trimmed.startsWith("whsec_")) {
    return Buffer.from(trimmed.slice(6), "base64");
  }
  return Buffer.from(trimmed, "utf8");
}

export function verifyResendWebhook(
  rawBody: string,
  headers: Headers,
  secret: string | undefined,
): boolean {
  if (!secret?.trim()) return false;
  const id = headers.get("svix-id");
  const timestamp = headers.get("svix-timestamp");
  const signature = headers.get("svix-signature");
  if (!id || !timestamp || !signature) return false;

  const signed = `${id}.${timestamp}.${rawBody}`;
  const expected = createHmac("sha256", parseWebhookSecret(secret))
    .update(signed)
    .digest("base64");
  const expectedBuf = Buffer.from(expected);

  return signature.split(" ").some((part) => {
    const value = part.startsWith("v1,") ? part.slice(3) : part;
    const given = Buffer.from(value);
    if (given.length !== expectedBuf.length) return false;
    return timingSafeEqual(given, expectedBuf);
  });
}

export type ResendEmailEvent = {
  type: string;
  emailId?: string;
};

export function parseResendEvent(payload: unknown): ResendEmailEvent | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as {
    type?: unknown;
    data?: { email_id?: unknown };
  };
  if (typeof record.type !== "string") return null;
  const emailId =
    typeof record.data?.email_id === "string" ? record.data.email_id : undefined;
  return { type: record.type, emailId };
}

export function emailStatusFromResendType(
  type: string,
): "sent" | "delivered" | "opened" | "bounced" | "failed" | null {
  if (type === "email.sent") return "sent";
  if (type === "email.delivered") return "delivered";
  if (type === "email.opened") return "opened";
  if (type === "email.bounced" || type === "email.complained") return "bounced";
  if (type === "email.failed") return "failed";
  return null;
}
