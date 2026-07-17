import { redirect } from "next/navigation";
import { MemberAuthHub } from "@/components/member-auth-hub";
import { getAuthUserSummary } from "@/lib/auth-user";

export const dynamic = "force-dynamic";

export default async function MemberPage() {
  const user = await getAuthUserSummary();
  if (!user) redirect("/login");
  return <MemberAuthHub initialUser={user} showPoints />;
}
