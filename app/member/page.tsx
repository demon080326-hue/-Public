import { redirect } from "next/navigation";
import { MemberAuthHub } from "@/components/member-auth-hub";
import { getCurrentMemberContext } from "@/lib/member-profile";

export const dynamic = "force-dynamic";

export default async function MemberPage() {
  const member = await getCurrentMemberContext();
  if (!member) redirect("/login");
  return <MemberAuthHub initialUser={member.user} initialProfile={member.profile} profileStatus={member.profileStatus} showPoints />;
}
