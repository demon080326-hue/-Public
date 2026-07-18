import { redirect } from "next/navigation";
import { AdminAccessNotice } from "@/components/admin-access-notice";
import { getCurrentMemberContext, hasAdminAccess, isSecurityAccessBlocked } from "@/lib/member-profile";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const member = await getCurrentMemberContext();
  if (!member) redirect("/login");
  if (isSecurityAccessBlocked(member)) {
    redirect(member.securityState?.requires_reverification ? "/login?notice=reverification-required" : "/login?error=auth-unavailable");
  }
  const role = member.profile?.role ?? null;
  return <AdminAccessNotice page="dashboard" role={role} accessGranted={hasAdminAccess(role)} />;
}
