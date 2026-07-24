import { NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/admin-access";
import { getAdminPaymentById, isValidPaymentSessionId, PaymentError } from "@/lib/payments";

export const runtime = "nodejs";

type AdminPaymentRouteProps = {
  params: Promise<{ id: string }>;
};

function accessError(status: string) {
  if (status === "unauthenticated") {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", message: "請先登入管理員帳號。" }, { status: 401 });
  }
  return NextResponse.json({ ok: false, code: "ADMIN_REQUIRED", message: "此功能僅限 admin 或 owner 使用。" }, { status: 403 });
}

export async function GET(_request: Request, { params }: AdminPaymentRouteProps) {
  const access = await requireAdminAccess();
  if (access.status !== "allowed") return accessError(access.status);

  const { id } = await params;
  if (!isValidPaymentSessionId(id)) {
    return NextResponse.json({ ok: false, code: "INVALID_PAYMENT_SESSION_ID", message: "付款準備 ID 格式不正確。" }, { status: 400 });
  }

  try {
    const detail = await getAdminPaymentById(id);
    if (!detail) {
      return NextResponse.json({ ok: false, code: "PAYMENT_NOT_FOUND", message: "找不到付款準備資料。" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, ...detail });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message.trim() }, {
        status: error.code === "SERVICE_UNAVAILABLE" ? 503 : 500,
      });
    }
    console.error("Admin payment detail API failed:", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, code: "PAYMENT_DETAIL_FAILED", message: "目前無法讀取付款準備資料。" }, { status: 500 });
  }
}
