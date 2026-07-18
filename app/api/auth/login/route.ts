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
  if (!securityResult.ok || !securityResult.state) {
    await supabase.auth.signOut();
    return NextResponse.json({ ok: false, message: SERVICE_UNAVAILABLE }, { status: 503 });
  }

  if (securityResult.state.requires_reverification) {
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
