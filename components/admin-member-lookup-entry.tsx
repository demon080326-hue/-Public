import Link from "next/link";

export function AdminMemberLookupEntry() {
  return (
    <section className="section dashboard-member-lookup">
      <div className="wrap">
        <div className="section-head">
          <div><span className="section-kicker">Member Admin</span><h2>會員查詢</h2></div>
          <p>查看會員角色、Email 驗證、點數與階級資料；本階段僅供查詢。</p>
        </div>
        <div className="route-grid four">
          <Link className="route-card" href="/admin/members">
            <div><span className="tag">Admin / Owner</span><h3>開啟會員查詢</h3><p>搜尋與篩選會員，查看唯讀詳細資料及最近紀錄。</p></div>
            <span className="card-link">查看會員 &rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
