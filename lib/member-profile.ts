import type { AuthUserSummary } from "@/lib/auth-user";
import { getAuthUserSummary } from "@/lib/auth-user";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { MemberRole, ProfileRow } from "@/types/database";

export type CurrentMemberContext = {
  user: AuthUserSummary;
  profile: ProfileRow | null;
  profileStatus: "ready" | "missing" | "error";
};

export function hasAdminAccess(role: MemberRole | null | undefined) {
  return role === "admin" || role === "owner";
}

export async function getCurrentMemberContext(): Promise<CurrentMemberContext | null> {
  const user = await getAuthUserSummary();
  if (!user) return null;

  const supabase = await getSupabaseServerClient();
  if (!supabase) return { user, profile: null, profileStatus: "error" };

  const { data, error } = await supabase
    .from("profiles")
    .select("user_id, email, display_name, role, email_verified, points_balance, created_at, updated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) return { user, profile: null, profileStatus: "error" };
  if (!data) return { user, profile: null, profileStatus: "missing" };
  return { user, profile: data, profileStatus: "ready" };
}
