import Link from "next/link";

export function AdminPaymentsEntry() {
  return (
    <section className="section dashboard-member-lookup">
      <div className="wrap">
        <div className="section-head">
          <div>
            <span className="section-kicker">Payment Preparation</span>
            <h2>付款準備查詢</h2>
          </div>
          <p>第 16 階段只建立 disabled Checkout 紀錄與唯讀查詢，沒有付款、退款、補點或商品解鎖操作。</p>
        </div>
        <div className="route-grid four">
          <Link className="route-card" href="/admin/payments">
            <div>
              <span className="tag">Admin / Owner</span>
              <h3>付款準備列表</h3>
              <p>查看 payment session、付款事件與 webhook 冪等紀錄，但不能手動改成已付款。</p>
            </div>
            <span className="card-link">查看付款準備 &rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
