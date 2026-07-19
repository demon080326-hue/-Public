import Link from "next/link";
import { getTierLabel } from "@/lib/member-tier";
import type { AdminMemberDetailResult } from "@/lib/admin-members";

function formatDate(value: string | null) {
  if (!value) return "無";
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

export function AdminMemberDetail({ detail }: { detail: AdminMemberDetailResult }) {
  const { member, pointRecords, tierRecords } = detail;

  return (
    <div className="admin-member-detail-grid">
      <section className="cms-panel">
        <div className="cms-library-head"><div><p className="eyebrow">Profile</p><h2>基本資料</h2></div><span className="cms-pill">唯讀</span></div>
        <dl className="member-profile-details">
          <div><dt>Email</dt><dd>{member.email ?? "未提供"}</dd></div>
          <div><dt>會員 ID</dt><dd className="admin-member-id">{member.user_id}</dd></div>
          <div><dt>角色</dt><dd>{member.role}</dd></div>
          <div><dt>Email 驗證</dt><dd>{member.email_verified ? "已驗證" : "待驗證"}</dd></div>
          <div><dt>帳號狀態</dt><dd>{member.account_status}</dd></div>
          <div><dt>建立時間</dt><dd>{formatDate(member.created_at)}</dd></div>
          <div><dt>更新時間</dt><dd>{formatDate(member.updated_at)}</dd></div>
        </dl>
      </section>

      <section className="cms-panel">
        <div className="cms-library-head"><div><p className="eyebrow">Points & tier</p><h2>點數與階級</h2></div></div>
        <dl className="member-profile-details">
          <div><dt>可用點數</dt><dd>{member.points_balance.toLocaleString("zh-TW")}</dd></div>
          <div><dt>歷史累積點數</dt><dd>{member.lifetime_earned_points.toLocaleString("zh-TW")}</dd></div>
          <div><dt>目前階級</dt><dd>{getTierLabel(member.current_tier)}（{member.current_tier}）</dd></div>
          <div><dt>最高階級</dt><dd>{getTierLabel(member.highest_tier)}（{member.highest_tier}）</dd></div>
          <div><dt>最低保障階級</dt><dd>{getTierLabel(member.minimum_tier)}（{member.minimum_tier}）</dd></div>
          <div><dt>有效消費累計</dt><dd>NT$ {member.total_valid_spend.toLocaleString("zh-TW")}</dd></div>
        </dl>
      </section>

      <section className="cms-panel admin-member-history">
        <div className="cms-library-head"><div><p className="eyebrow">Ledger</p><h2>最近點數紀錄</h2></div><span className="cms-pill">最近 10 筆</span></div>
        {pointRecords.length ? <ol className="point-records">{pointRecords.map((record) => <li key={record.id}><strong>{record.source_type}</strong><span>{record.amount > 0 ? "+" : ""}{record.amount} 點</span><small>{record.note ?? "無備註"} · {formatDate(record.created_at)} · 餘額 {record.balance_after}</small></li>)}</ol> : <p className="cms-empty">目前沒有點數紀錄。</p>}
      </section>

      <section className="cms-panel admin-member-history">
        <div className="cms-library-head"><div><p className="eyebrow">Tier history</p><h2>最近階級紀錄</h2></div><span className="cms-pill">最近 10 筆</span></div>
        {tierRecords.length ? <ol className="point-records">{tierRecords.map((record) => <li key={record.id}><strong>{record.old_tier ? getTierLabel(record.old_tier) : "初始"} → {getTierLabel(record.new_tier)}</strong><span>{record.reason}</span><small>{formatDate(record.created_at)}</small></li>)}</ol> : <p className="cms-empty">目前沒有階級異動紀錄。</p>}
      </section>

      <div className="admin-member-detail-actions">
        <Link className="btn secondary" href="/admin/members">返回會員查詢</Link>
        <Link className="btn secondary" href="/admin">返回管理系統</Link>
      </div>
    </div>
  );
}
