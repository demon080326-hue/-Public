import { redirect } from "next/navigation";
import { MemberAuthHub } from "@/components/member-auth-hub";
import { getCurrentMemberContext, isSecurityAccessBlocked } from "@/lib/member-profile";

export const dynamic = "force-dynamic";

type MemberPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
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

  return <MemberAuthHub initialUser={member.user} initialProfile={member.profile} profileStatus={member.profileStatus} initialSecurityState={member.securityState} securityStatus={member.securityStatus} initialNotice={initialNotice} showPoints />;
}
