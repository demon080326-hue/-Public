import { randomInt } from "node:crypto";
import { NextResponse } from "next/server";
import {
  cancelReverificationCode,
  createReverificationCode,
  getReverificationTarget,
  recordAuthSecurityEvent,
} from "@/lib/auth-security";
import { getEmailDeliveryConfiguration, sendEmail } from "@/lib/email/send-email";
import { buildReverificationEmail } from "@/lib/email/templates";

export const runtime = "nodejs";

const GENERIC_SUCCESS = "如果此帳號需要重新驗證，我們已寄出 6 位數驗證碼。";
const DELIVERY_NOT_CONFIGURED = "驗證信服務尚未設定，請稍後再試。";

function json(body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function isValidEmail(email: string) {
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const configuration = getEmailDeliveryConfiguration();
  if (!configuration.configured) {
    return json({ ok: false, error: "EMAIL_NOT_CONFIGURED", message: DELIVERY_NOT_CONFIGURED }, 503);
  }

  let email = "";
  try {
    const body = (await request.json()) as { email?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return json({ ok: true, message: GENERIC_SUCCESS });
  }

  if (!isValidEmail(email)) {
    return json({ ok: true, message: GENERIC_SUCCESS });
  }

  const target = await getReverificationTarget(email);
  if (!target || !target.requiresReverification) {
    return json({ ok: true, message: GENERIC_SUCCESS });
  }

  const plainCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
  const codeId = await createReverificationCode(target.userId, plainCode);
  if (!codeId) {
    return json({ ok: true, message: GENERIC_SUCCESS });
  }

  const template = buildReverificationEmail(plainCode);
  const delivery = await sendEmail({
    to: email,
    ...template,
    idempotencyKey: `reverification-${codeId}`,
  });

  if (!delivery.ok) {
    await cancelReverificationCode(codeId, target.userId);
    await recordAuthSecurityEvent(target.userId, "verification_email_failed", {
      purpose: "login_reverification",
      provider: "resend",
      reason: delivery.reason,
    });
    return json({ ok: true, message: GENERIC_SUCCESS });
  }

  await recordAuthSecurityEvent(target.userId, "verification_email_sent", {
    purpose: "login_reverification",
    provider: delivery.provider,
  });

  return json({ ok: true, message: GENERIC_SUCCESS });
}
