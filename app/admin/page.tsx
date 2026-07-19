import { redirect } from "next/navigation";
import { AdminAccessNotice } from "@/components/admin-access-notice";
import { AdminAuditSummary } from "@/components/admin-audit-summary";
import { AdminMemberLookupEntry } from "@/components/admin-member-lookup-entry";
import { CmsDashboard } from "@/components/cms-dashboard";
import { requireAdminAccess } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const access = await requireAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?notice=admin-auth-required");
  if (access.status !== "allowed") return <AdminAccessNotice page="dashboard" state={access} />;

  return (
    <>
      <CmsDashboard />
      <AdminMemberLookupEntry />
      <AdminAuditSummary />
    </>
  );
}
