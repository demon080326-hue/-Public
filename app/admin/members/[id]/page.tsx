import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminAccessNotice } from "@/components/admin-access-notice";
import { AdminMemberDetail } from "@/components/admin-member-detail";
import { requireAdminAccess } from "@/lib/admin-access";
import { getAdminMemberDetail, isValidProfileId, writeAdminMemberAuditSafely } from "@/lib/admin-members";
import type { AdminMemberDetailResult } from "@/lib/admin-members";

export const dynamic = "force-dynamic";

type AdminMemberDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminMemberDetailPage({ params }: AdminMemberDetailPageProps) {
  const access = await requireAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?notice=admin-auth-required");
  if (access.status !== "allowed") return <AdminAccessNotice page="dashboard" state={access} />;

  const { id } = await params;
  if (!isValidProfileId(id)) {
    return <MemberLookupError message="會員 ID 格式不正確。" />;
  }

  let detail: AdminMemberDetailResult | null = null;
  let errorMessage: string | null = null;

  try {
    detail = await getAdminMemberDetail(id);

    if (detail && access.user && access.role) {
      const requestHeaders = new Headers(await headers());
      await writeAdminMemberAuditSafely({
        actor: { userId: access.user.id, email: access.user.email, role: access.role },
        action: "manual_admin_action",
        resourceType: "profile",
        resourceId: detail.member.user_id,
        targetUserId: detail.member.user_id,
        targetEmail: detail.member.email,
        reason: "admin_member_detail_view",
        metadata: { viewed_sections: ["profile", "points", "tier", "ledger"] },
        request: new Request("https://internal/admin/members/detail", { headers: requestHeaders }),
      });
    }
  } catch {
    errorMessage = "目前無法讀取會員詳細資料，請稍後再試。";
  }

  if (errorMessage) return <MemberLookupError message={errorMessage} />;
  if (!detail) return <MemberLookupError message="找不到會員資料。" />;

  return (
    <>
      <section className="page-hero admin-member-hero">
        <div className="wrap">
          <p className="eyebrow">Admin Member Detail</p>
          <h1>會員詳細資料</h1>
          <p className="page-copy">{detail.member.email ?? "未提供 Email"} · {detail.member.role}</p>
          <p className="admin-readonly-notice">此頁只顯示既有資料，不提供編輯、刪除、調點數或調階級功能。</p>
        </div>
      </section>
      <section className="section admin-member-section"><div className="wrap"><AdminMemberDetail detail={detail} /></div></section>
    </>
  );
}

function MemberLookupError({ message }: { message: string }) {
  return (
    <section className="access-notice-section">
      <div className="wrap access-notice">
        <span className="tag">READ ONLY</span>
        <h1>會員查詢</h1>
        <p>{message}</p>
        <Link className="btn secondary" href="/admin/members">返回會員列表</Link>
      </div>
    </section>
  );
}
