import { NextResponse } from "next/server";
import { getCurrentMemberContext, isSecurityAccessBlocked } from "@/lib/member-profile";
import { getMemberOrderById, isValidOrderId, OrderError } from "@/lib/orders";

export const runtime = "nodejs";

type MemberOrderRouteProps = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, { params }: MemberOrderRouteProps) {
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

  const { id } = await params;
  if (!isValidOrderId(id)) {
    return NextResponse.json(
      { ok: false, code: "INVALID_ORDER_ID", message: "訂單 ID 格式不正確。" },
      { status: 400 },
    );
  }

  try {
    const detail = await getMemberOrderById(member.user.id, id);
    if (!detail) {
      // Return the same result for missing and other members' orders to avoid leaking existence.
      return NextResponse.json(
        { ok: false, code: "ORDER_NOT_FOUND", message: "找不到這筆訂單。" },
        { status: 404 },
      );
    }
    return NextResponse.json({ ok: true, ...detail });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.code === "SERVICE_UNAVAILABLE" ? 503 : 500 },
      );
    }
    console.error("Member order detail API failed:", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, code: "ORDER_DETAIL_FAILED", message: "目前無法讀取你的訂單。" },
      { status: 500 },
    );
  }
}
