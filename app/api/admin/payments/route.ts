import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/admin-access";
import { getAdminPaymentList, normalizeAdminPaymentFilters, PaymentError } from "@/lib/payments";

export const runtime = "nodejs";

function accessError(status: string) {
  if (status === "unauthenticated") {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", message: "請先登入管理員帳號。" }, { status: 401 });
  }
  return NextResponse.json({ ok: false, code: "ADMIN_REQUIRED", message: "此功能僅限 admin 或 owner 使用。" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const access = await requireAdminAccess();
  if (access.status !== "allowed") return accessError(access.status);

  try {
    const result = await getAdminPaymentList(normalizeAdminPaymentFilters(request.nextUrl.searchParams));
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof PaymentError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message.trim() }, {
        status: error.code === "SERVICE_UNAVAILABLE" ? 503 : 500,
      });
    }
    console.error("Admin payments API failed:", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, code: "PAYMENT_LIST_FAILED", message: "目前無法查詢付款準備資料。" }, { status: 500 });
  }
}
