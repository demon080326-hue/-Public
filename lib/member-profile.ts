import type { AuthUserSummary } from "@/lib/auth-user";
import { getAuthUserSummary } from "@/lib/auth-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { AuthSecurityStateRow, MemberRole, ProfileRow } from "@/types/database";

export type CurrentMemberContext = {
  user: AuthUserSummary;
  profile: ProfileRow | null;
  profileStatus: "ready" | "missing" | "error";
  securityState: AuthSecurityStateRow | null;
  securityStatus: "ready" | "missing" | "error";
};

export function hasAdminAccess(role: MemberRole | null | undefined) {
  return role === "admin" || role === "owner";
}

export function isSecurityAccessBlocked(member: CurrentMemberContext) {
  return member.securityStatus !== "ready" || member.securityState?.requires_reverification !== false;
}

type CurrentMemberOptions = {
  syncProfileFromAuth?: boolean;
};

export async function getCurrentMemberContext(
  options: CurrentMemberOptions = {},
): Promise<CurrentMemberContext | null> {
  const user = await getAuthUserSummary();
  if (!user) return null;

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    return {
      user,
      profile: null,
      profileStatus: "error",
      securityState: null,
      securityStatus: "error",
    };
  }

  const { data: securityState, error: securityError } = await supabase
    .from("auth_security_state")
    .select("user_id, failed_login_count, requires_reverification, locked_until, last_failed_login_at, last_successful_login_at, created_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  const securityStatus = securityError ? "error" : securityState ? "ready" : "missing";

  if (options.syncProfileFromAuth && securityStatus === "ready" && securityState && !securityState.requires_reverification) {
    const { data: syncedProfiles, error: syncError } = await supabase.rpc("sync_own_profile_from_auth");
    const syncedProfile = syncedProfiles?.[0] ?? null;

    if (!syncError && syncedProfile) {
      return {
        user,
        profile: syncedProfile,
        profileStatus: "ready",
        securityState,
        securityStatus,
      };
    }
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, email, display_name, role, email_verified, points_balance, current_tier, highest_tier, minimum_tier, lifetime_earned_points, lifetime_redeemed_points, total_valid_spend, last_valid_purchase_at, downgrade_exempt, upgrade_disabled, account_status, created_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    return { user, profile: null, profileStatus: "error", securityState, securityStatus };
  }
  if (!data) {
    return { user, profile: null, profileStatus: "missing", securityState, securityStatus };
  }
  return { user, profile: data, profileStatus: "ready", securityState, securityStatus };
}
