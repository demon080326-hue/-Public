import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/admin-access";
import { writeAdminAuditLog } from "@/lib/admin-audit-log";
import { isValidProfileId } from "@/lib/admin-members";
import {
  adjustAdminMemberPoints,
  AdminPointsAdjustmentError,
  validateAdminPointsAdjustment,
} from "@/lib/admin-points";

export const runtime = "nodejs";

type PointsAdjustRouteProps = {
  params: Promise<{ id: string }>;
};

function accessError(status: string) {
  if (status === "unauthenticated") {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", message: "請先登入管理員帳號。" }, { status: 401 });
  }
  return NextResponse.json({ ok: false, code: "ADMIN_REQUIRED", message: "此功能僅限 admin 或 owner 使用。" }, { status: 403 });
}

export async function POST(request: NextRequest, { params }: PointsAdjustRouteProps) {
  const access = await requireAdminAccess();
  if (access.status !== "allowed") return accessError(access.status);
  if (!access.user || !access.role) {
    return NextResponse.json({ ok: false, code: "ADMIN_IDENTITY_MISSING", message: "無法確認管理員身分。" }, { status: 500 });
  }

  const { id } = await params;
  if (!isValidProfileId(id)) {
    return NextResponse.json({ ok: false, code: "INVALID_MEMBER_ID", message: "會員 ID 格式不正確。" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "請提供有效的 JSON 資料。" }, { status: 400 });
  }

  const validation = validateAdminPointsAdjustment(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, code: validation.code, message: validation.message }, { status: 400 });
  }

  try {
    const result = await adjustAdminMemberPoints({
      memberId: id,
      adjustment: validation.input,
      actorUserId: access.user.id,
      actorEmail: access.user.email,
    });

    const auditWritten = await writeAdminAuditLog({
      actor: { userId: access.user.id, email: access.user.email, role: access.role },
      action: "member_points_adjust",
      resourceType: "member_points",
      resourceId: result.ledgerId,
      targetUserId: result.memberId,
      targetEmail: result.targetEmail,
      beforeData: { points_balance: result.beforePoints },
      afterData: { points_balance: result.afterPoints, delta: result.delta },
      reason: validation.input.reason,
      metadata: {
        adjustment_type: result.adjustmentType,
        points: result.points,
        ledger_id: result.ledgerId,
        stage: "stage12_admin_points_adjust",
      },
      request,
    });

    if (!auditWritten) {
      console.error("Admin points adjustment audit log was not written:", { ledgerId: result.ledgerId });
    }

    return NextResponse.json({
      ok: true,
      memberId: result.memberId,
      beforePoints: result.beforePoints,
      afterPoints: result.afterPoints,
      delta: result.delta,
    });
  } catch (error) {
    if (error instanceof AdminPointsAdjustmentError) {
      const status = error.code === "MEMBER_NOT_FOUND" ? 404 : error.code === "INSUFFICIENT_POINTS" ? 400 : 500;
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
    }

    console.error("Admin points adjustment API failed:", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ ok: false, code: "ADJUSTMENT_FAILED", message: "點數調整失敗，請稍後再試。" }, { status: 500 });
  }
}
