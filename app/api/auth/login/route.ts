import { NextResponse } from "next/server";
import { recordLoginFailure, recordLoginSuccess } from "@/lib/auth-security";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const GENERIC_LOGIN_ERROR = "帳號或密碼錯誤，請確認後再試。";
const SERVICE_UNAVAILABLE = "登入服務目前無法使用，請稍後再試。";

export async function POST(request: Request) {
  let email = "";
  let password = "";

  try {
    const body = (await request.json()) as { email?: unknown; password?: unknown };
    email = typeof body.email === "string" ? body.email.trim() : "";
    password = typeof body.password === "string" ? body.password : "";
  } catch {
    return NextResponse.json({ ok: false, message: GENERIC_LOGIN_ERROR }, { status: 401 });
  }

  if (!email || !password) {
    return NextResponse.json({ ok: false, message: GENERIC_LOGIN_ERROR }, { status: 401 });
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return NextResponse.json({ ok: false, message: SERVICE_UNAVAILABLE }, { status: 503 });
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error || !data.user?.email) {
    await recordLoginFailure(request, email);
    return NextResponse.json({ ok: false, message: GENERIC_LOGIN_ERROR }, { status: 401 });
  }

  const securityResult = await recordLoginSuccess(request, data.user.id, data.user.email);
  let securityState = securityResult.ok ? securityResult.state : null;

  if (!securityResult.ok || !securityState) {
    const { data: ownSecurityState, error: ownSecurityError } = await supabase
      .from("auth_security_state")
      .select("user_id, failed_login_count, requires_reverification, locked_until, last_failed_login_at, last_successful_login_at, created_at, updated_at")
      .eq("user_id", data.user.id)
      .maybeSingle();

    const canUseSafeFallback =
      !ownSecurityError &&
      ownSecurityState !== null &&
      ownSecurityState.failed_login_count === 0 &&
      ownSecurityState.requires_reverification === false &&
      ownSecurityState.locked_until === null;

    if (!canUseSafeFallback) {
      console.error("Login security verification unavailable; sign-in was rejected.", {
        hasSecurityState: ownSecurityState !== null,
        hasReadError: Boolean(ownSecurityError),
      });
      await supabase.auth.signOut();
      return NextResponse.json({ ok: false, message: SERVICE_UNAVAILABLE }, { status: 503 });
    }

    console.error("Login security recording unavailable; using verified read-only safe state.");
    securityState = ownSecurityState;
  }

  if (securityState.requires_reverification) {
    return NextResponse.json({ ok: true, requiresReverification: true });
  }

  const { data: syncedProfiles } = await supabase.rpc("sync_own_profile_from_auth");
  const syncedProfile = syncedProfiles?.[0] ?? null;

  return NextResponse.json({
    ok: true,
    requiresReverification: false,
    memberActivated: syncedProfile?.email_verified === true && syncedProfile.role === "member",
  });
}
