import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminAccessNotice } from "@/components/admin-access-notice";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { requireAdminAccess } from "@/lib/admin-access";
import {
  formatOrderAmount,
  getAdminOrderList,
  normalizeAdminOrderFilters,
  ORDER_PAYMENT_STATUS_KEYS,
  ORDER_STATUS_KEYS,
  OrderError,
  type AdminOrderFilters,
  type AdminOrderListResult,
} from "@/lib/orders";

export const dynamic = "force-dynamic";

type AdminOrdersPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

function pageHref(filters: AdminOrderFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.paymentStatus) params.set("payment_status", filters.paymentStatus);
  params.set("limit", String(filters.limit));
  params.set("page", String(page));
  return `/admin/orders?${params.toString()}`;
}

export default async function AdminOrdersPage({ searchParams }: AdminOrdersPageProps) {
  const access = await requireAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?notice=admin-auth-required");
  if (access.status !== "allowed") {
    return <AdminAccessNotice page="dashboard" state={access} />;
  }

  const filters = normalizeAdminOrderFilters(await searchParams);
  let result: AdminOrderListResult | null = null;
  let error: string | null = null;

  try {
    result = await getAdminOrderList(filters);
  } catch (caught) {
    error = caught instanceof OrderError ? caught.message : "目前無法讀取訂單資料。";
  }

  return (
    <>
      <section className="page-hero admin-member-hero">
        <div className="wrap">
          <p className="eyebrow">Admin Orders</p>
          <h1>訂單查詢</h1>
          <p className="page-copy">
            本頁僅供 owner／admin 查詢。第 15 階段沒有付款、退款、出貨、點數或解鎖功能。
          </p>
        </div>
      </section>

      <section className="section admin-member-section">
        <div className="wrap">
          <form className="cms-panel admin-order-filters" method="get" action="/admin/orders">
            <label>
              訂單編號或 Email
              <input
                className="form-input"
                type="search"
                name="search"
                defaultValue={filters.search}
                maxLength={200}
                placeholder="輸入訂單編號或會員 Email"
              />
            </label>
            <label>
              訂單狀態
              <select className="form-input" name="status" defaultValue={filters.status ?? ""}>
                <option value="">全部狀態</option>
                {ORDER_STATUS_KEYS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              付款狀態
              <select
                className="form-input"
                name="payment_status"
                defaultValue={filters.paymentStatus ?? ""}
              >
                <option value="">全部狀態</option>
                {ORDER_PAYMENT_STATUS_KEYS.map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
            </label>
            <label>
              每頁筆數
              <select className="form-input" name="limit" defaultValue={String(filters.limit)}>
                {[10, 20, 30, 50].map((limit) => (
                  <option key={limit} value={limit}>{limit}</option>
                ))}
              </select>
            </label>
            <div className="admin-member-filter-actions">
              <button className="btn" type="submit">查詢</button>
              <Link className="btn secondary" href="/admin/orders">清除條件</Link>
            </div>
          </form>

          <div className="cms-panel admin-member-results">
            <div className="cms-library-head">
              <div>
                <p className="eyebrow">Read only</p>
                <h2>訂單列表</h2>
              </div>
              <span className="cms-pill">{result ? `${result.total} 筆` : "查詢中"}</span>
            </div>

            {error ? <p className="cms-empty" role="alert">{error}</p> : null}
            {!error && result && result.orders.length === 0 ? (
              <p className="cms-empty">目前沒有符合條件的訂單。尚未啟用正式 checkout。</p>
            ) : null}

            {!error && result && result.orders.length > 0 ? (
              <div className="admin-member-table-wrap">
                <table className="admin-member-table admin-order-table">
                  <thead>
                    <tr>
                      <th>訂單編號</th>
                      <th>會員 Email</th>
                      <th>訂單狀態</th>
                      <th>付款狀態</th>
                      <th>總額</th>
                      <th>建立時間</th>
                      <th>詳細</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.orders.map((order) => (
                      <tr key={order.id}>
                        <td><strong>{order.order_number}</strong></td>
                        <td>{order.buyer_email ?? "未提供"}</td>
                        <td><OrderStatusBadge kind="order" status={order.status} /></td>
                        <td><OrderStatusBadge kind="payment" status={order.payment_status} /></td>
                        <td>{formatOrderAmount(order.total_cents, order.currency)}</td>
                        <td><time dateTime={order.created_at}>{formatDate(order.created_at)}</time></td>
                        <td>
                          <Link className="admin-member-detail-link" href={`/admin/orders/${order.id}`}>
                            查看
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {result && result.totalPages > 1 ? (
              <nav className="admin-member-pagination" aria-label="訂單分頁">
                {result.page > 1 ? (
                  <Link className="btn secondary" href={pageHref(filters, result.page - 1)}>上一頁</Link>
                ) : <span />}
                <span>第 {result.page} / {result.totalPages} 頁</span>
                {result.page < result.totalPages ? (
                  <Link className="btn secondary" href={pageHref(filters, result.page + 1)}>下一頁</Link>
                ) : <span />}
              </nav>
            ) : null}
          </div>
        </div>
      </section>
    </>
  );
}
