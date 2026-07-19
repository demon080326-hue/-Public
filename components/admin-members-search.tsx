import Link from "next/link";
import { getTierLabel, MEMBER_TIER_LABELS } from "@/lib/member-tier";
import type { AdminMemberListFilters, AdminMemberListResult } from "@/lib/admin-members";
import type { MemberRole, MemberTierKey } from "@/types/database";

const roles: MemberRole[] = ["pending_member", "member", "admin", "owner"];
const tiers = Object.keys(MEMBER_TIER_LABELS) as MemberTierKey[];

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

function pageHref(filters: AdminMemberListFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.role) params.set("role", filters.role);
  if (filters.tier) params.set("tier", filters.tier);
  if (filters.emailVerified !== null) params.set("email_verified", String(filters.emailVerified));
  params.set("limit", String(filters.limit));
  params.set("page", String(page));
  return `/admin/members?${params.toString()}`;
}

export function AdminMembersSearch({
  filters,
  result,
  error,
}: {
  filters: AdminMemberListFilters;
  result: AdminMemberListResult | null;
  error: string | null;
}) {
  return (
    <>
      <div className="admin-member-stats" aria-label="會員角色統計">
        <article><span>總會員數</span><strong>{result?.total ?? 0}</strong></article>
        <article><span>Owner</span><strong>{result?.roleCounts.owner ?? 0}</strong></article>
        <article><span>Admin</span><strong>{result?.roleCounts.admin ?? 0}</strong></article>
        <article><span>Member</span><strong>{result?.roleCounts.member ?? 0}</strong></article>
        <article><span>待驗證</span><strong>{result?.roleCounts.pending_member ?? 0}</strong></article>
      </div>

      <form className="cms-panel admin-member-filters" method="get" action="/admin/members">
        <label>
          搜尋 Email
          <input className="form-input" type="search" name="search" defaultValue={filters.search} maxLength={320} placeholder="輸入完整或部分 Email" />
        </label>
        <label>
          角色
          <select className="form-input" name="role" defaultValue={filters.role ?? ""}>
            <option value="">全部角色</option>
            {roles.map((role) => <option value={role} key={role}>{role}</option>)}
          </select>
        </label>
        <label>
          目前階級
          <select className="form-input" name="tier" defaultValue={filters.tier ?? ""}>
            <option value="">全部階級</option>
            {tiers.map((tier) => <option value={tier} key={tier}>{getTierLabel(tier)}</option>)}
          </select>
        </label>
        <label>
          Email 驗證
          <select className="form-input" name="email_verified" defaultValue={filters.emailVerified === null ? "" : String(filters.emailVerified)}>
            <option value="">全部狀態</option>
            <option value="true">已驗證</option>
            <option value="false">待驗證</option>
          </select>
        </label>
        <label>
          每頁筆數
          <select className="form-input" name="limit" defaultValue={String(filters.limit)}>
            {[10, 20, 30, 50].map((limit) => <option value={limit} key={limit}>{limit}</option>)}
          </select>
        </label>
        <div className="admin-member-filter-actions">
          <button className="btn" type="submit">查詢</button>
          <Link className="btn secondary" href="/admin/members">清除條件</Link>
        </div>
      </form>

      <div className="cms-panel admin-member-results">
        <div className="cms-library-head">
          <div>
            <p className="eyebrow">Read only</p>
            <h2>會員列表</h2>
          </div>
          <span className="cms-pill">{result ? `${result.total} 筆` : "查詢失敗"}</span>
        </div>

        {error ? <p className="cms-empty" role="alert">{error}</p> : null}
        {!error && result?.members.length === 0 ? <p className="cms-empty">找不到符合條件的會員。</p> : null}

        {!error && result && result.members.length > 0 ? (
          <div className="admin-member-table-wrap">
            <table className="admin-member-table">
              <thead><tr><th>Email</th><th>角色</th><th>驗證</th><th>目前階級</th><th>點數</th><th>累積點數</th><th>狀態</th><th>最近更新</th><th>查看</th></tr></thead>
              <tbody>
                {result.members.map((member) => (
                  <tr key={member.user_id}>
                    <td><strong>{member.email ?? "未提供 Email"}</strong></td>
                    <td><span className="cms-pill">{member.role}</span></td>
                    <td>{member.email_verified ? "已驗證" : "待驗證"}</td>
                    <td>{getTierLabel(member.current_tier)}</td>
                    <td>{member.points_balance.toLocaleString("zh-TW")}</td>
                    <td>{member.lifetime_earned_points.toLocaleString("zh-TW")}</td>
                    <td>{member.account_status}</td>
                    <td><time dateTime={member.updated_at}>{formatDate(member.updated_at)}</time></td>
                    <td><Link className="admin-member-detail-link" href={`/admin/members/${member.user_id}`}>查看詳細</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {result && result.totalPages > 1 ? (
          <nav className="admin-member-pagination" aria-label="會員列表分頁">
            {result.page > 1 ? <Link className="btn secondary" href={pageHref(filters, result.page - 1)}>上一頁</Link> : <span />}
            <span>第 {result.page} / {result.totalPages} 頁</span>
            {result.page < result.totalPages ? <Link className="btn secondary" href={pageHref(filters, result.page + 1)}>下一頁</Link> : <span />}
          </nav>
        ) : null}
      </div>
    </>
  );
}
