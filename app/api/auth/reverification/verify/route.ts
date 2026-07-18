import { NextResponse } from "next/server";
import { getReverificationTarget, recordAuthSecurityEvent, verifyReverificationCode } from "@/lib/auth-security";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const INVALID_CODE = "驗證碼不正確或已過期，請確認後再試。";

function json(body: Record<string, unknown>, status = 200) {
  const response = NextResponse.json(body, { status });
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

function isValidEmail(email: string) {
  return email.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  let email = "";
  let code = "";
  try {
    const body = (await request.json()) as { email?: unknown; code?: unknown };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    code = typeof body.code === "string" ? body.code.trim() : "";
  } catch {
    return json({ ok: false, message: INVALID_CODE }, 400);
  }

  if (!isValidEmail(email) || !/^\d{6}$/.test(code)) {
    return json({ ok: false, message: INVALID_CODE }, 400);
  }

  const target = await getReverificationTarget(email);
  if (!target || !target.requiresReverification) {
    return json({ ok: false, message: INVALID_CODE }, 400);
  }

  const verification = await verifyReverificationCode(target.userId, code);
  if (!verification.ok) {
    return json({ ok: false, message: INVALID_CODE }, 400);
  }

  if (!verification.verified) {
    await recordAuthSecurityEvent(target.userId, "reverification_failed", {
      provider: "custom_email_code",
    });
    return json({ ok: false, message: INVALID_CODE }, 400);
  }

  const supabase = await getSupabaseServerClient();
  if (supabase) {
    await supabase.auth.signOut();
  }

  return json({ ok: true, message: "帳號安全驗證完成，請重新登入。" });
}
