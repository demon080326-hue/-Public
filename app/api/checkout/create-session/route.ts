import { NextRequest, NextResponse } from "next/server";
import { createDisabledCheckoutSession, CheckoutError } from "@/lib/checkout";
import { getCurrentMemberContext, isSecurityAccessBlocked } from "@/lib/member-profile";

export const runtime = "nodejs";

function memberAccessError() {
  return NextResponse.json(
    { ok: false, code: "MEMBER_REQUIRED", message: "完成 Email 驗證後才能建立付款準備。" },
    { status: 403 },
  );
}

function errorStatus(error: CheckoutError) {
  switch (error.code) {
    case "INVALID_ORDER_ID":
    case "ORDER_NOT_ELIGIBLE":
      return 400;
    case "ORDER_FORBIDDEN":
      return 403;
    case "ORDER_NOT_FOUND":
      return 404;
    case "SERVICE_UNAVAILABLE":
      return 503;
    default:
      return 500;
  }
}

export async function POST(request: NextRequest) {
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
    return memberAccessError();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { ok: false, code: "INVALID_JSON", message: "請提供有效的 JSON 資料。" },
      { status: 400 },
    );
  }

  if (
    !body
    || typeof body !== "object"
    || Array.isArray(body)
    || Object.keys(body).length !== 1
    || !("orderId" in body)
    || typeof body.orderId !== "string"
  ) {
    return NextResponse.json(
      { ok: false, code: "INVALID_REQUEST", message: "本 API 只接受 orderId。" },
      { status: 400 },
    );
  }

  try {
    const result = await createDisabledCheckoutSession({
      orderId: body.orderId,
      userId: member.user.id,
    });

    return NextResponse.json({
      ok: true,
      mode: "disabled",
      message: "Checkout is prepared but real payment is not enabled yet.",
      paymentSessionId: result.session.id,
      paymentUrl: null,
      created: result.wasCreated,
    });
  } catch (error) {
    if (error instanceof CheckoutError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message.trim() },
        { status: errorStatus(error) },
      );
    }
    console.error("Checkout create-session API failed:", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, code: "CHECKOUT_CREATE_FAILED", message: "目前無法建立付款準備。" },
      { status: 500 },
    );
  }
}
