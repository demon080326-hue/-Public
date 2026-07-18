import { NextResponse } from "next/server";
import { getAuthSecurityState, recordAuthSecurityEvent } from "@/lib/auth-security";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: "驗證服務目前無法使用，請稍後再試。" }, { status: 503 });
  }

  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user?.email) {
    return NextResponse.json({ ok: false, message: "請先重新登入。" }, { status: 401 });
  }

  const securityResult = await getAuthSecurityState(user.id);
  if (!securityResult.ok || !securityResult.state) {
    return NextResponse.json({ ok: false, message: "驗證服務目前無法使用，請稍後再試。" }, { status: 503 });
  }

  if (!securityResult.state.requires_reverification) {
    return NextResponse.json({ ok: false, message: "此帳號目前不需要重新驗證。" }, { status: 409 });
  }

  const { error: otpError } = await supabase.auth.signInWithOtp({
    email: user.email,
    options: { shouldCreateUser: false },
  });

  if (otpError) {
    return NextResponse.json({ ok: false, message: "目前無法寄送驗證碼，請稍後再試。" }, { status: 429 });
  }

  await recordAuthSecurityEvent(user.id, "reverification_requested", { provider: "supabase_auth_email_otp" });
  return NextResponse.json({ ok: true, message: "驗證信已寄出，請輸入信中的 6 位數驗證碼。" });
}
