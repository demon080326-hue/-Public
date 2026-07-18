import { NextResponse } from "next/server";
import { clearReverification, getAuthSecurityState, recordAuthSecurityEvent } from "@/lib/auth-security";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const INVALID_CODE = "驗證碼無效或已過期，請重新申請後再試。";

export async function POST(request: Request) {
  let code = "";
  try {
    const body = (await request.json()) as { code?: unknown };
    code = typeof body.code === "string" ? body.code.trim() : "";
  } catch {
    return NextResponse.json({ ok: false, message: INVALID_CODE }, { status: 400 });
  }

  if (!/^\d{6}$/.test(code)) {
    return NextResponse.json({ ok: false, message: INVALID_CODE }, { status: 400 });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "驗證服務目前無法使用，請稍後再試。" }, { status: 503 });
  }

  const { data: currentData, error: currentError } = await supabase.auth.getUser();
  const currentUser = currentData.user;
  if (currentError || !currentUser?.email) {
    return NextResponse.json({ ok: false, message: "請先重新登入。" }, { status: 401 });
  }

  const securityResult = await getAuthSecurityState(currentUser.id);
  if (!securityResult.ok || !securityResult.state?.requires_reverification) {
    return NextResponse.json({ ok: false, message: "此帳號目前不需要重新驗證。" }, { status: 409 });
  }

  const { data: verifiedData, error: verifyError } = await supabase.auth.verifyOtp({
    email: currentUser.email,
    token: code,
    type: "email",
  });

  if (verifyError || verifiedData.user?.id !== currentUser.id) {
    await recordAuthSecurityEvent(currentUser.id, "reverification_failed", { provider: "supabase_auth_email_otp" });
    return NextResponse.json({ ok: false, message: INVALID_CODE }, { status: 400 });
  }

  const clearResult = await clearReverification(currentUser.id);
  if (!clearResult.ok) {
    return NextResponse.json({ ok: false, message: "驗證服務目前無法使用，請稍後再試。" }, { status: 503 });
  }

  return NextResponse.json({ ok: true, message: "Email 重新驗證完成。" });
}
