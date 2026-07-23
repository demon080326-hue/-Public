import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/admin-access";
import { writeAdminAuditLog } from "@/lib/admin-audit-log";
import { getAdminOrderById, isValidOrderId, OrderError } from "@/lib/orders";

export const runtime = "nodejs";

type AdminOrderRouteProps = {
  params: Promise<{ id: string }>;
};

function accessError(status: string) {
  if (status === "unauthenticated") {
    return NextResponse.json(
      { ok: false, code: "AUTH_REQUIRED", message: "請先登入管理員帳號。" },
      { status: 401 },
    );
  }
  return NextResponse.json(
    { ok: false, code: "ADMIN_REQUIRED", message: "此功能僅限 admin 或 owner 使用。" },
    { status: 403 },
  );
}

export async function GET(request: NextRequest, { params }: AdminOrderRouteProps) {
  const access = await requireAdminAccess();
  if (access.status !== "allowed") return accessError(access.status);
  if (!access.user || !access.role) {
    return NextResponse.json(
      { ok: false, code: "ADMIN_IDENTITY_MISSING", message: "無法確認管理員身分。" },
      { status: 500 },
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
    const detail = await getAdminOrderById(id);
    if (!detail) {
      return NextResponse.json(
        { ok: false, code: "ORDER_NOT_FOUND", message: "找不到訂單資料。" },
        { status: 404 },
      );
    }

    const auditWritten = await writeAdminAuditLog({
      actor: { userId: access.user.id, email: access.user.email, role: access.role },
      action: "manual_admin_action",
      resourceType: "order",
      resourceId: detail.order.id,
      reason: "admin_order_detail_view",
      metadata: {
        stage: "stage15_orders",
        order_number: detail.order.order_number,
      },
      request,
    });
    if (!auditWritten) {
      console.error("Admin order detail audit log was not written:", { orderId: id });
    }

    return NextResponse.json({ ok: true, ...detail });
  } catch (error) {
    if (error instanceof OrderError) {
      return NextResponse.json(
        { ok: false, code: error.code, message: error.message },
        { status: error.code === "SERVICE_UNAVAILABLE" ? 503 : 500 },
      );
    }
    console.error("Admin order detail API failed:", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json(
      { ok: false, code: "ORDER_DETAIL_FAILED", message: "目前無法讀取訂單詳細資料。" },
      { status: 500 },
    );
  }
}
