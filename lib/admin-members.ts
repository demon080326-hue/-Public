import "server-only";

import { writeAdminAuditLog } from "@/lib/admin-audit-log";
import type { WriteAdminAuditLogInput } from "@/lib/admin-audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type {
  MemberAccountStatus,
  MemberPointsSourceType,
  MemberRole,
  MemberTierHistoryReason,
  MemberTierKey,
} from "@/types/database";

const MEMBER_ROLES: MemberRole[] = ["pending_member", "member", "admin", "owner"];
const MEMBER_TIERS: MemberTierKey[] = [
  "super_poor",
  "poor",
  "commoner",
  "merchant",
  "noble",
  "royal_citizen",
  "royal_relative",
  "royal_direct",
  "king",
];

const PROFILE_FIELDS = [
  "user_id",
  "email",
  "display_name",
  "role",
  "email_verified",
  "points_balance",
  "current_tier",
  "highest_tier",
  "minimum_tier",
  "lifetime_earned_points",
  "total_valid_spend",
  "account_status",
  "created_at",
  "updated_at",
].join(",");

export type AdminMemberListItem = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: MemberRole;
  email_verified: boolean;
  points_balance: number;
  current_tier: MemberTierKey;
  highest_tier: MemberTierKey;
  minimum_tier: MemberTierKey;
  lifetime_earned_points: number;
  total_valid_spend: number;
  account_status: MemberAccountStatus;
  created_at: string;
  updated_at: string;
};

export type AdminMemberListFilters = {
  search: string;
  role: MemberRole | null;
  tier: MemberTierKey | null;
  emailVerified: boolean | null;
  page: number;
  limit: number;
};

export type AdminMemberRoleCounts = Record<MemberRole, number>;

export type AdminMemberListResult = {
  members: AdminMemberListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  roleCounts: AdminMemberRoleCounts;
};

export type AdminMemberPointRecord = {
  id: string;
  amount: number;
  balance_after: number;
  lifetime_earned_after: number;
  source_type: MemberPointsSourceType;
  note: string | null;
  checkin_date: string | null;
  created_at: string;
};

export type AdminMemberTierRecord = {
  id: string;
  old_tier: MemberTierKey | null;
  new_tier: MemberTierKey;
  reason: MemberTierHistoryReason;
  created_at: string;
};

export type AdminMemberDetailResult = {
  member: AdminMemberListItem;
  pointRecords: AdminMemberPointRecord[];
  tierRecords: AdminMemberTierRecord[];
};

function firstValue(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isMemberRole(value: string | undefined): value is MemberRole {
  return Boolean(value && MEMBER_ROLES.includes(value as MemberRole));
}

function isMemberTier(value: string | undefined): value is MemberTierKey {
  return Boolean(value && MEMBER_TIERS.includes(value as MemberTierKey));
}

export function normalizeAdminMemberFilters(
  input: Record<string, string | string[] | undefined> | URLSearchParams,
): AdminMemberListFilters {
  const read = (name: string) => input instanceof URLSearchParams ? input.get(name) ?? undefined : firstValue(input[name]);
  const role = read("role");
  const tier = read("tier");
  const verified = read("email_verified");

  return {
    search: (read("search") ?? "").trim().slice(0, 320),
    role: isMemberRole(role) ? role : null,
    tier: isMemberTier(tier) ? tier : null,
    emailVerified: verified === "true" ? true : verified === "false" ? false : null,
    page: Math.min(positiveInteger(read("page"), 1), 10_000),
    limit: Math.min(positiveInteger(read("limit"), 20), 50),
  };
}

function escapeIlike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function isValidProfileId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function writeAdminMemberAuditSafely(input: WriteAdminAuditLogInput) {
  try {
    return await writeAdminAuditLog(input);
  } catch (error) {
    console.error("Admin member lookup audit write failed:", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return false;
  }
}

export async function getAdminMemberList(filters: AdminMemberListFilters): Promise<AdminMemberListResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("ADMIN_MEMBER_LOOKUP_UNAVAILABLE");

  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;
  let query = supabase
    .from("profiles")
    .select(PROFILE_FIELDS, { count: "exact" })
    .order("updated_at", { ascending: false })
    .range(from, to);

  if (filters.search) query = query.ilike("email", `%${escapeIlike(filters.search.toLowerCase())}%`);
  if (filters.role) query = query.eq("role", filters.role);
  if (filters.tier) query = query.eq("current_tier", filters.tier);
  if (filters.emailVerified !== null) query = query.eq("email_verified", filters.emailVerified);

  const [membersResult, ...roleResults] = await Promise.all([
    query,
    ...MEMBER_ROLES.map((role) => supabase.from("profiles").select("user_id", { count: "exact", head: true }).eq("role", role)),
  ]);

  if (membersResult.error) {
    console.error("Admin member list query failed:", {
      code: membersResult.error.code,
      message: membersResult.error.message,
    });
    throw new Error("ADMIN_MEMBER_LIST_QUERY_FAILED");
  }

  const failedRoleCount = roleResults.find((result) => result.error);
  if (failedRoleCount?.error) {
    console.error("Admin member role count query failed:", {
      code: failedRoleCount.error.code,
      message: failedRoleCount.error.message,
    });
    throw new Error("ADMIN_MEMBER_ROLE_COUNT_QUERY_FAILED");
  }

  const roleCounts = Object.fromEntries(
    MEMBER_ROLES.map((role, index) => [role, roleResults[index].count ?? 0]),
  ) as AdminMemberRoleCounts;
  const total = membersResult.count ?? 0;

  return {
    members: (membersResult.data ?? []) as unknown as AdminMemberListItem[],
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    roleCounts,
  };
}

export async function getAdminMemberDetail(userId: string): Promise<AdminMemberDetailResult | null> {
  if (!isValidProfileId(userId)) return null;

  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new Error("ADMIN_MEMBER_LOOKUP_UNAVAILABLE");

  const [profileResult, pointsResult, tiersResult] = await Promise.all([
    supabase.from("profiles").select(PROFILE_FIELDS).eq("user_id", userId).maybeSingle(),
    supabase
      .from("member_points_ledger")
      .select("id,amount,balance_after,lifetime_earned_after,source_type,note,checkin_date,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("member_tier_history")
      .select("id,old_tier,new_tier,reason,created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  for (const result of [profileResult, pointsResult, tiersResult]) {
    if (result.error) {
      console.error("Admin member detail query failed:", {
        code: result.error.code,
        message: result.error.message,
      });
      throw new Error("ADMIN_MEMBER_DETAIL_QUERY_FAILED");
    }
  }

  if (!profileResult.data) return null;

  return {
    member: profileResult.data as unknown as AdminMemberListItem,
    pointRecords: (pointsResult.data ?? []) as AdminMemberPointRecord[],
    tierRecords: (tiersResult.data ?? []) as AdminMemberTierRecord[],
  };
}
