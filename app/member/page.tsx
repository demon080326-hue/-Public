import { redirect } from "next/navigation";
import { MemberAuthHub } from "@/components/member-auth-hub";
import { getCurrentMemberContext, isSecurityAccessBlocked } from "@/lib/member-profile";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type MemberPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function taipeiDateKey(value: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(value);
}

function countRecentStreak(checkinDates: string[]) {
  const uniqueDates = new Set(checkinDates);
  let streak = 0;
  const cursor = new Date(`${taipeiDateKey(new Date())}T00:00:00.000Z`);

  while (uniqueDates.has(cursor.toISOString().slice(0, 10))) {
    streak += 1;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

export default async function MemberPage({ searchParams }: MemberPageProps) {
  const [member, params] = await Promise.all([
    getCurrentMemberContext({ syncProfileFromAuth: true }),
    searchParams,
  ]);
  if (!member) redirect("/login");
  if (isSecurityAccessBlocked(member)) {
    redirect(member.securityState?.requires_reverification ? "/login?notice=reverification-required" : "/login?error=auth-unavailable");
  }
  const notice = first(params.notice);
  const initialNotice = notice === "email-verified-member" || notice === "email-verification-required" || notice === "reverification-passed"
    ? notice
    : null;
  const supabase = await getSupabaseServerClient();
  const [ledgerResult, tierSettingsResult] = supabase
    ? await Promise.all([
        supabase
          .from("member_points_ledger")
          .select("id, user_id, amount, balance_after, lifetime_earned_after, source_type, note, checkin_date, metadata, created_at")
          .eq("user_id", member.user.id)
          .order("created_at", { ascending: false })
          .limit(12),
        supabase
          .from("member_tier_settings")
          .select("id, tier_key, tier_name, sort_order, required_valid_spend, required_lifetime_points, is_manual_only, is_active, created_at, updated_at")
          .eq("is_active", true)
          .order("sort_order", { ascending: true }),
      ])
    : [{ data: null }, { data: null }];
  const pointsLedger = ledgerResult.data ?? [];
  const today = taipeiDateKey(new Date());
  const dailyClaimedToday = pointsLedger.some((record) => record.source_type === "daily_checkin" && record.checkin_date === today);
  const streakDays = countRecentStreak(
    pointsLedger
      .filter((record) => record.source_type === "daily_checkin" && record.checkin_date)
      .map((record) => record.checkin_date as string),
  );

  return (
    <MemberAuthHub
      initialUser={member.user}
      initialProfile={member.profile}
      profileStatus={member.profileStatus}
      initialSecurityState={member.securityState}
      securityStatus={member.securityStatus}
      initialNotice={initialNotice}
      showPoints
      pointsLedger={pointsLedger}
      tierSettings={tierSettingsResult.data ?? []}
      dailyClaimedToday={dailyClaimedToday}
      streakDays={streakDays}
    />
  );
}
