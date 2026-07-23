import { NextResponse } from "next/server";
import { getCurrentMemberContext, isSecurityAccessBlocked } from "@/lib/member-profile";
import { getMemberOrderList, OrderError } from "@/lib/orders";

export const runtime = "nodejs";

export async function GET() {
  const member = await getCurrentMemberContext({ syncProfileFromAuth: true });
  if (!member) {
    return NextResponse.json(
      { ok: false, code: "AUTH_REQUIRED", message: "請先登入會員帳號。" },
      { status: 401 },
    );
  }
  if (
    member.profileStatus !== "ready"
    || !member.profile
    || member.profile.role === "pending_member"
    || !member.user.emailVerified
    || !member.profile.email_verified
    || isSecurityAccessBlocked(member)
  ) {
    return NextResponse.json(
      { ok: false, code: "MEMBER_REQUIRED", message: "完成 Email 驗證後才能查看正式會員訂單。" },
      { status: 403 },
    );
  }

  try {
    const orders = await getMemberOrderList(member.user.id);
    return NextResponse.json({ ok: true, orders });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.code === "SERVICE_UNAVAILABLE" ? 503 : 500 },
      );
    }
    console.error("Member order list API failed:", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, code: "ORDER_LIST_FAILED", message: "目前無法讀取你的訂單。" },
      { status: 500 },
    );
  }
}
