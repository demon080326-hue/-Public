import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { Json, MemberTierKey } from "@/types/database";

export type AdminPointsAdjustmentType = "add" | "deduct";

export type AdminPointsAdjustmentInput = {
  type: AdminPointsAdjustmentType;
  points: number;
  reason: string;
};

export type AdminPointsAdjustmentResult = {
  memberId: string;
  targetEmail: string | null;
  beforePoints: number;
  afterPoints: number;
  delta: number;
  points: number;
  adjustmentType: AdminPointsAdjustmentType;
  ledgerId: string;
  lifetimeEarnedPoints: number;
  currentTier: MemberTierKey;
  highestTier: MemberTierKey;
  minimumTier: MemberTierKey;
};

export class AdminPointsAdjustmentError extends Error {
  constructor(
    public readonly code: "MEMBER_NOT_FOUND" | "INSUFFICIENT_POINTS" | "ADJUSTMENT_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "AdminPointsAdjustmentError";
  }
}

type RpcResult = {
  ok?: boolean;
  member_id?: string;
  target_email?: string | null;
  before_points?: number;
  after_points?: number;
  delta?: number;
  points?: number;
  adjustment_type?: AdminPointsAdjustmentType;
  ledger_id?: string;
  lifetime_earned_points?: number;
  current_tier?: MemberTierKey;
  highest_tier?: MemberTierKey;
  minimum_tier?: MemberTierKey;
};

function asRpcResult(value: Json): RpcResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as RpcResult;
}

function hasValidRpcResult(value: RpcResult | null): value is Required<Omit<RpcResult, "target_email">> & Pick<RpcResult, "target_email"> {
  return Boolean(
    value?.ok === true &&
    typeof value.member_id === "string" &&
    typeof value.before_points === "number" &&
    typeof value.after_points === "number" &&
    typeof value.delta === "number" &&
    typeof value.points === "number" &&
    (value.adjustment_type === "add" || value.adjustment_type === "deduct") &&
    typeof value.ledger_id === "string" &&
    typeof value.lifetime_earned_points === "number" &&
    typeof value.current_tier === "string" &&
    typeof value.highest_tier === "string" &&
    typeof value.minimum_tier === "string",
  );
}

export function validateAdminPointsAdjustment(value: unknown):
  | { ok: true; input: AdminPointsAdjustmentInput }
  | { ok: false; code: string; message: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "INVALID_BODY", message: "請提供完整的點數調整資料。" };
  }

  const body = value as Record<string, unknown>;
  if (body.type !== "add" && body.type !== "deduct") {
    return { ok: false, code: "INVALID_TYPE", message: "請選擇加點或扣點。" };
  }

  if (typeof body.points !== "number" || !Number.isInteger(body.points) || body.points < 1 || body.points > 10000) {
    return { ok: false, code: "INVALID_POINTS", message: "點數必須是 1 到 10000 的正整數。" };
  }

  if (typeof body.reason !== "string") {
    return { ok: false, code: "INVALID_REASON", message: "請填寫調整原因。" };
  }

  const reason = body.reason.trim();
  if (reason.length < 5 || reason.length > 300) {
    return { ok: false, code: "INVALID_REASON", message: "原因需為 5 到 300 個字。" };
  }

  return { ok: true, input: { type: body.type, points: body.points, reason } };
}

export async function adjustAdminMemberPoints(input: {
  memberId: string;
  adjustment: AdminPointsAdjustmentInput;
  actorUserId: string;
  actorEmail: string | null;
}) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new AdminPointsAdjustmentError("ADJUSTMENT_FAILED", "後台點數服務目前無法使用。");
  }

  const { data, error } = await supabase.rpc("admin_adjust_member_points", {
    p_target_user_id: input.memberId,
    p_adjustment_type: input.adjustment.type,
    p_points: input.adjustment.points,
    p_reason: input.adjustment.reason,
    p_actor_user_id: input.actorUserId,
    p_actor_email: input.actorEmail,
  });

  if (error) {
    if (error.message.includes("MEMBER_NOT_FOUND")) {
      throw new AdminPointsAdjustmentError("MEMBER_NOT_FOUND", "找不到會員資料。");
    }
    if (error.message.includes("INSUFFICIENT_POINTS")) {
      throw new AdminPointsAdjustmentError("INSUFFICIENT_POINTS", "扣點後不可低於 0 點。");
    }

    console.error("Admin points adjustment RPC failed:", { code: error.code, message: error.message });
    throw new AdminPointsAdjustmentError("ADJUSTMENT_FAILED", "點數調整失敗，請稍後再試。");
  }

  const result = asRpcResult(data);
  if (!hasValidRpcResult(result)) {
    console.error("Admin points adjustment RPC returned an invalid result.");
    throw new AdminPointsAdjustmentError("ADJUSTMENT_FAILED", "點數調整結果不完整，請稍後再試。");
  }

  return {
    memberId: result.member_id,
    targetEmail: result.target_email ?? null,
    beforePoints: result.before_points,
    afterPoints: result.after_points,
    delta: result.delta,
    points: result.points,
    adjustmentType: result.adjustment_type,
    ledgerId: result.ledger_id,
    lifetimeEarnedPoints: result.lifetime_earned_points,
    currentTier: result.current_tier,
    highestTier: result.highest_tier,
    minimumTier: result.minimum_tier,
  } satisfies AdminPointsAdjustmentResult;
}
