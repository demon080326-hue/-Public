import { redirect } from "next/navigation";
import { AdminAccessNotice } from "@/components/admin-access-notice";
import { getCurrentMemberContext, hasAdminAccess } from "@/lib/member-profile";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const member = await getCurrentMemberContext();
  if (!member) redirect("/login");
  const role = member.profile?.role ?? null;
  return <AdminAccessNotice page="dashboard" role={role} accessGranted={hasAdminAccess(role)} />;
}
