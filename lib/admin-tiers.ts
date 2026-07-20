import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { canActorAssignTier, isMemberTierKey } from "@/lib/member-tier";
import type { Json, MemberRole, MemberTierKey } from "@/types/database";

export { canActorAssignTier, isMemberTierKey };

export type AdminTierAdjustmentInput = {
  targetTier: MemberTierKey;
  reason: string;
};

export type AdminTierAdjustmentResult = {
  memberId: string;
  targetEmail: string | null;
  beforeTier: MemberTierKey;
  afterTier: MemberTierKey;
  beforeHighestTier: MemberTierKey;
  highestTier: MemberTierKey;
  minimumTier: MemberTierKey;
  highestTierRaised: boolean;
  historyId: string;
};

export type AdminTierAdjustmentErrorCode =
  | "MEMBER_NOT_FOUND"
  | "INVALID_TIER"
  | "INVALID_REASON"
  | "TIER_UNCHANGED"
  | "TIER_OWNER_ONLY"
  | "KING_ALREADY_EXISTS"
  | "ADJUSTMENT_FAILED";

export class AdminTierAdjustmentError extends Error {
  constructor(
    public readonly code: AdminTierAdjustmentErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdminTierAdjustmentError";
  }
}

export function validateAdminTierAdjustment(value: unknown):
  | { ok: true; input: AdminTierAdjustmentInput }
  | { ok: false; code: string; message: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { ok: false, code: "INVALID_BODY", message: "請提供完整的階級調整資料。" };
  }

  const body = value as Record<string, unknown>;

  if (!isMemberTierKey(body.targetTier)) {
    return { ok: false, code: "INVALID_TIER", message: "請選擇合法的會員階級。" };
  }

  if (typeof body.reason !== "string") {
    return { ok: false, code: "INVALID_REASON", message: "請填寫調整原因。" };
  }

  const reason = body.reason.trim();
  if (reason.length < 5 || reason.length > 300) {
    return { ok: false, code: "INVALID_REASON", message: "原因需為 5 到 300 個字。" };
  }

  return { ok: true, input: { targetTier: body.targetTier, reason } };
}

type RpcResult = {
  ok?: boolean;
  member_id?: string;
  target_email?: string | null;
  before_tier?: MemberTierKey;
  after_tier?: MemberTierKey;
  before_highest_tier?: MemberTierKey;
  highest_tier?: MemberTierKey;
  minimum_tier?: MemberTierKey;
  highest_tier_raised?: boolean;
  history_id?: string;
};

function asRpcResult(value: Json): RpcResult | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as RpcResult;
}

function hasValidRpcResult(value: RpcResult | null): value is Required<Omit<RpcResult, "target_email">> &
  Pick<RpcResult, "target_email"> {
  return Boolean(
    value?.ok === true &&
      typeof value.member_id === "string" &&
      isMemberTierKey(value.before_tier) &&
      isMemberTierKey(value.after_tier) &&
      isMemberTierKey(value.before_highest_tier) &&
      isMemberTierKey(value.highest_tier) &&
      isMemberTierKey(value.minimum_tier) &&
      typeof value.highest_tier_raised === "boolean" &&
      typeof value.history_id === "string",
  );
}

function mapRpcError(message: string): AdminTierAdjustmentError {
  if (message.includes("MEMBER_NOT_FOUND")) {
    return new AdminTierAdjustmentError("MEMBER_NOT_FOUND", "找不到會員資料。");
  }
  if (message.includes("KING_ALREADY_EXISTS")) {
    return new AdminTierAdjustmentError("KING_ALREADY_EXISTS", "已有一位會員是國王，同一時間只能有一位國王。");
  }
  if (message.includes("TIER_OWNER_ONLY")) {
    return new AdminTierAdjustmentError("TIER_OWNER_ONLY", "只有 owner 可以設定皇室親屬、皇室直系或國王階級。");
  }
  if (message.includes("TIER_UNCHANGED")) {
    return new AdminTierAdjustmentError("TIER_UNCHANGED", "目標階級與目前階級相同，未做任何調整。");
  }
  if (message.includes("INVALID_TIER")) {
    return new AdminTierAdjustmentError("INVALID_TIER", "請選擇合法的會員階級。");
  }
  if (message.includes("INVALID_REASON")) {
    return new AdminTierAdjustmentError("INVALID_REASON", "原因需為 5 到 300 個字。");
  }
  return new AdminTierAdjustmentError("ADJUSTMENT_FAILED", "階級調整失敗，請稍後再試。");
}

export async function adjustAdminMemberTier(input: {
  memberId: string;
  adjustment: AdminTierAdjustmentInput;
  actorUserId: string;
  actorEmail: string | null;
  actorRole: MemberRole;
}): Promise<AdminTierAdjustmentResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new AdminTierAdjustmentError("ADJUSTMENT_FAILED", "後台階級服務目前無法使用。");
  }

  const { data, error } = await supabase.rpc("admin_adjust_member_tier", {
    p_target_user_id: input.memberId,
    p_target_tier: input.adjustment.targetTier,
    p_reason: input.adjustment.reason,
    p_actor_user_id: input.actorUserId,
    p_actor_email: input.actorEmail,
    p_actor_role: input.actorRole,
  });

  if (error) {
    const mapped = mapRpcError(error.message ?? "");
    if (mapped.code === "ADJUSTMENT_FAILED") {
      console.error("Admin tier adjustment RPC failed:", { code: error.code, message: error.message });
    }
    throw mapped;
  }

  const result = asRpcResult(data);
  if (!hasValidRpcResult(result)) {
    console.error("Admin tier adjustment RPC returned an invalid result.");
    throw new AdminTierAdjustmentError("ADJUSTMENT_FAILED", "階級調整結果不完整，請稍後再試。");
  }

  return {
    memberId: result.member_id,
    targetEmail: result.target_email ?? null,
    beforeTier: result.before_tier,
    afterTier: result.after_tier,
    beforeHighestTier: result.before_highest_tier,
    highestTier: result.highest_tier,
    minimumTier: result.minimum_tier,
    highestTierRaised: result.highest_tier_raised,
    historyId: result.history_id,
  } satisfies AdminTierAdjustmentResult;
}
