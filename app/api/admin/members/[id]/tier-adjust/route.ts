import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/admin-access";
import { writeAdminAuditLog } from "@/lib/admin-audit-log";
import { isValidProfileId } from "@/lib/admin-members";
import {
  adjustAdminMemberTier,
  AdminTierAdjustmentError,
  canActorAssignTier,
  validateAdminTierAdjustment,
} from "@/lib/admin-tiers";

export const runtime = "nodejs";

type TierAdjustRouteProps = {
  params: Promise<{ id: string }>;
};

function accessError(status: string) {
  if (status === "unauthenticated") {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", message: "請先登入管理員帳號。" }, { status: 401 });
  }
  return NextResponse.json({ ok: false, code: "ADMIN_REQUIRED", message: "此功能僅限 admin 或 owner 使用。" }, { status: 403 });
}

function errorStatus(code: AdminTierAdjustmentError["code"]) {
  switch (code) {
    case "MEMBER_NOT_FOUND":
      return 404;
    case "TIER_OWNER_ONLY":
      return 403;
    case "INVALID_TIER":
    case "INVALID_REASON":
    case "TIER_UNCHANGED":
    case "KING_ALREADY_EXISTS":
      return 400;
    default:
      return 500;
  }
}

export async function POST(request: NextRequest, { params }: TierAdjustRouteProps) {
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

  const validation = validateAdminTierAdjustment(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, code: validation.code, message: validation.message }, { status: 400 });
  }

  // Primary permission gate: only owner may assign the high-privilege royal tiers.
  if (!canActorAssignTier(access.role, validation.input.targetTier)) {
    return NextResponse.json(
      { ok: false, code: "TIER_OWNER_ONLY", message: "只有 owner 可以設定皇室親屬、皇室直系或國王階級。" },
      { status: 403 },
    );
  }

  try {
    const result = await adjustAdminMemberTier({
      memberId: id,
      adjustment: validation.input,
      actorUserId: access.user.id,
      actorEmail: access.user.email,
      actorRole: access.role,
    });

    const auditWritten = await writeAdminAuditLog({
      actor: { userId: access.user.id, email: access.user.email, role: access.role },
      action: "member_tier_adjust",
      resourceType: "member_tier",
      resourceId: result.historyId,
      targetUserId: result.memberId,
      targetEmail: result.targetEmail,
      beforeData: {
        current_tier: result.beforeTier,
        highest_tier: result.beforeHighestTier,
        minimum_tier: result.minimumTier,
      },
      afterData: {
        current_tier: result.afterTier,
        highest_tier: result.highestTier,
        minimum_tier: result.minimumTier,
      },
      reason: validation.input.reason,
      metadata: {
        stage: "stage13_admin_tier_adjust",
        manual_adjustment: true,
        highest_tier_raised: result.highestTierRaised,
        points_balance_unchanged: true,
        lifetime_earned_points_unchanged: true,
        total_valid_spend_unchanged: true,
      },
      request,
    });

    if (!auditWritten) {
      console.error("Admin tier adjustment audit log was not written:", { historyId: result.historyId });
    }

    return NextResponse.json({
      ok: true,
      memberId: result.memberId,
      beforeTier: result.beforeTier,
      afterTier: result.afterTier,
      highestTier: result.highestTier,
    });
  } catch (error) {
    if (error instanceof AdminTierAdjustmentError) {
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status: errorStatus(error.code) });
    }

    console.error("Admin tier adjustment API failed:", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return NextResponse.json({ ok: false, code: "ADJUSTMENT_FAILED", message: "階級調整失敗，請稍後再試。" }, { status: 500 });
  }
}
