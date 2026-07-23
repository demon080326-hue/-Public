import Link from "next/link";

export function AdminOrdersEntry() {
  return (
    <section className="section dashboard-member-lookup">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="section-kicker">Order Admin</span>
            <h2>訂單查詢</h2>
          </div>
          <p>
            第 15 階段只提供唯讀訂單查詢，不包含付款、退款、出貨、點數入帳或商品解鎖。
          </p>
        </div>
        <div className="route-grid four">
          <Link className="route-card" href="/admin/orders">
            <div>
              <span className="tag">Admin / Owner</span>
              <h3>訂單列表</h3>
              <p>依訂單編號、Email 與狀態查詢訂單，並查看訂單詳細與事件紀錄。</p>
            </div>
            <span className="card-link">查看訂單 &rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
