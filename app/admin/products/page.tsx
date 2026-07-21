import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminAccessNotice } from "@/components/admin-access-notice";
import { requireAdminAccess } from "@/lib/admin-access";
import {
  getAdminProductList,
  normalizeAdminProductFilters,
  ProductError,
  type AdminProductListFilters,
  type AdminProductListResult,
} from "@/lib/products";
import {
  formatPriceTWD,
  PRODUCT_STATUS_KEYS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_TYPE_KEYS,
  PRODUCT_TYPE_LABELS,
} from "@/lib/product-schema";

export const dynamic = "force-dynamic";

type AdminProductsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Taipei" }).format(new Date(value));
}

function pageHref(filters: AdminProductListFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.productType) params.set("product_type", filters.productType);
  params.set("limit", String(filters.limit));
  params.set("page", String(page));
  return `/admin/products?${params.toString()}`;
}

export default async function AdminProductsPage({ searchParams }: AdminProductsPageProps) {
  const access = await requireAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?notice=admin-auth-required");
  if (access.status !== "allowed") return <AdminAccessNotice page="dashboard" state={access} />;

  const filters = normalizeAdminProductFilters(await searchParams);

  let result: AdminProductListResult | null = null;
  let error: string | null = null;
  try {
    result = await getAdminProductList(filters);
  } catch (caught) {
    error = caught instanceof ProductError ? caught.message : "目前無法讀取商品資料，請稍後再試。";
  }

  return (
    <>
      <section className="page-hero admin-member-hero">
        <div className="wrap">
          <p className="eyebrow">Admin Products</p>
          <h1>商品管理</h1>
          <p className="page-copy">建立、編輯、上架與下架商城商品。本階段不含金流、訂單與購物車。</p>
        </div>
      </section>

      <section className="section admin-member-section">
        <div className="wrap">
          <div className="admin-member-stats" aria-label="商品狀態統計">
            <article><span>商品總數</span><strong>{result?.total ?? 0}</strong></article>
            <article><span>草稿</span><strong>{result?.statusCounts.draft ?? 0}</strong></article>
            <article><span>已發布</span><strong>{result?.statusCounts.published ?? 0}</strong></article>
            <article><span>已下架</span><strong>{result?.statusCounts.archived ?? 0}</strong></article>
          </div>

          <form className="cms-panel admin-member-filters" method="get" action="/admin/products">
            <label>
              搜尋名稱 / slug
              <input className="form-input" type="search" name="search" defaultValue={filters.search} maxLength={200} placeholder="輸入名稱或 slug" />
            </label>
            <label>
              狀態
              <select className="form-input" name="status" defaultValue={filters.status ?? ""}>
                <option value="">全部狀態</option>
                {PRODUCT_STATUS_KEYS.map((key) => <option key={key} value={key}>{PRODUCT_STATUS_LABELS[key]}</option>)}
              </select>
            </label>
            <label>
              商品類型
              <select className="form-input" name="product_type" defaultValue={filters.productType ?? ""}>
                <option value="">全部類型</option>
                {PRODUCT_TYPE_KEYS.map((key) => <option key={key} value={key}>{PRODUCT_TYPE_LABELS[key]}</option>)}
              </select>
            </label>
            <label>
              每頁筆數
              <select className="form-input" name="limit" defaultValue={String(filters.limit)}>
                {[10, 20, 30, 50].map((limit) => <option key={limit} value={limit}>{limit}</option>)}
              </select>
            </label>
            <div className="admin-member-filter-actions">
              <button className="btn" type="submit">查詢</button>
              <Link className="btn secondary" href="/admin/products">清除條件</Link>
              <Link className="btn" href="/admin/products/new">＋ 新增商品</Link>
            </div>
          </form>

          <div className="cms-panel admin-member-results">
            <div className="cms-library-head">
              <div><p className="eyebrow">Catalog</p><h2>商品列表</h2></div>
              <span className="cms-pill">{result ? `${result.total} 筆` : "查詢失敗"}</span>
            </div>

            {error ? <p className="cms-empty" role="alert">{error}</p> : null}
            {!error && result && result.products.length === 0 ? <p className="cms-empty">目前沒有符合條件的商品。</p> : null}

            {!error && result && result.products.length > 0 ? (
              <div className="admin-member-table-wrap">
                <table className="admin-member-table">
                  <thead><tr><th>名稱</th><th>Slug</th><th>類型</th><th>售價</th><th>狀態</th><th>庫存</th><th>精選</th><th>更新</th><th>編輯</th></tr></thead>
                  <tbody>
                    {result.products.map((product) => (
                      <tr key={product.id}>
                        <td><strong>{product.name}</strong></td>
                        <td>{product.slug}</td>
                        <td>{PRODUCT_TYPE_LABELS[product.product_type]}</td>
                        <td>{formatPriceTWD(product.price_cents)}</td>
                        <td><span className="cms-pill">{PRODUCT_STATUS_LABELS[product.status]}</span></td>
                        <td>{product.stock_status}</td>
                        <td>{product.is_featured ? "★" : "—"}</td>
                        <td><time dateTime={product.updated_at}>{formatDate(product.updated_at)}</time></td>
                        <td><Link className="admin-member-detail-link" href={`/admin/products/${product.id}/edit`}>編輯</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {result && result.totalPages > 1 ? (
              <nav className="admin-member-pagination" aria-label="商品列表分頁">
                {result.page > 1 ? <Link className="btn secondary" href={pageHref(filters, result.page - 1)}>上一頁</Link> : <span />}
                <span>第 {result.page} / {result.totalPages} 頁</span>
                {result.page < result.totalPages ? <Link className="btn secondary" href={pageHref(filters, result.page + 1)}>下一頁</Link> : <span />}
              </nav>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
