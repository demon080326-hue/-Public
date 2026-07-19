import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AdminAccessNotice } from "@/components/admin-access-notice";
import { AdminMembersSearch } from "@/components/admin-members-search";
import { requireAdminAccess } from "@/lib/admin-access";
import { getAdminMemberList, normalizeAdminMemberFilters, writeAdminMemberAuditSafely } from "@/lib/admin-members";
import type { AdminMemberListResult } from "@/lib/admin-members";

export const dynamic = "force-dynamic";

type AdminMembersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AdminMembersPage({ searchParams }: AdminMembersPageProps) {
  const access = await requireAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?notice=admin-auth-required");
  if (access.status !== "allowed") return <AdminAccessNotice page="dashboard" state={access} />;

  const filters = normalizeAdminMemberFilters(await searchParams);
  let result: AdminMemberListResult | null = null;
  let error: string | null = null;

  try {
    result = await getAdminMemberList(filters);

    if (access.user && access.role) {
      const requestHeaders = new Headers(await headers());
      await writeAdminMemberAuditSafely({
        actor: { userId: access.user.id, email: access.user.email, role: access.role },
        action: "manual_admin_action",
        resourceType: "profile",
        reason: "admin_member_search",
        metadata: {
          has_search: Boolean(filters.search),
          role_filter: filters.role,
          tier_filter: filters.tier,
          email_verified_filter: filters.emailVerified,
          result_count: result.members.length,
          limit: filters.limit,
          page: filters.page,
        },
        request: new Request("https://internal/admin/members", { headers: requestHeaders }),
      });
    }
  } catch {
    error = "目前無法查詢會員資料，請稍後再試。";
  }

  return (
    <>
      <section className="page-hero admin-member-hero">
        <div className="wrap">
          <p className="eyebrow">Admin Member Lookup</p>
          <h1>會員查詢</h1>
          <p className="page-copy">查看會員角色、Email 驗證、點數與階級資料。本頁僅供查詢，不提供修改功能。</p>
          <p className="admin-readonly-notice">本階段為唯讀查詢系統，不能調整點數、不能調整階級、不能刪除會員。</p>
        </div>
      </section>
      <section className="section admin-member-section">
        <div className="wrap">
          <AdminMembersSearch filters={filters} result={result} error={error} />
        </div>
      </section>
    </>
  );
}
