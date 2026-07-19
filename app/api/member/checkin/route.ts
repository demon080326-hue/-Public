import { NextResponse } from "next/server";
import { getAuthUserSummary } from "@/lib/auth-user";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

export async function POST() {
  const user = await getAuthUserSummary();
  if (!user) {
    return NextResponse.json({ ok: false, reason: "AUTH_REQUIRED" }, { status: 401 });
  }

  const admin = getSupabaseAdminClient();
  if (!admin) {
    return NextResponse.json({ ok: false, reason: "SERVICE_UNAVAILABLE" }, { status: 503 });
  }

  const { data, error } = await admin.rpc("claim_member_daily_checkin", { p_user_id: user.id });
  if (error) {
    console.error("member checkin failed", { code: error.code, message: error.message });
    return NextResponse.json({ ok: false, reason: "CHECKIN_FAILED" }, { status: 500 });
  }

  return NextResponse.json(data);
}
