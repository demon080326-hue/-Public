import Link from "next/link";

export function AdminProductsEntry() {
  return (
    <section className="section dashboard-member-lookup">
      <div className="wrap">
        <div className="section-head">
          <div><span className="section-kicker">Product Admin</span><h2>商品管理</h2></div>
          <p>建立、編輯、上架與下架商城商品。本階段只做商品資料庫化，不含金流、訂單與購物車。</p>
        </div>
        <div className="route-grid four">
          <Link className="route-card" href="/admin/products">
            <div><span className="tag">Admin / Owner</span><h3>開啟商品管理</h3><p>搜尋與篩選商品，編輯資料、切換 draft / published / archived。</p></div>
            <span className="card-link">管理商品 &rarr;</span>
          </Link>
          <Link className="route-card" href="/admin/products/new">
            <div><span className="tag">New</span><h3>新增商品</h3><p>建立一筆新商品，存成草稿或直接發布到前台 /shop。</p></div>
            <span className="card-link">新增商品 &rarr;</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
