import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminAccessNotice } from "@/components/admin-access-notice";
import { PaymentStatusBadge } from "@/components/payment-status-badge";
import { requireAdminAccess } from "@/lib/admin-access";
import { formatOrderAmount } from "@/lib/orders";
import {
  getAdminPaymentList,
  normalizeAdminPaymentFilters,
  PaymentError,
  PAYMENT_MODE_KEYS,
  PAYMENT_PROVIDER_KEYS,
  PAYMENT_SESSION_STATUS_KEYS,
  type AdminPaymentFilters,
} from "@/lib/payments";

export const dynamic = "force-dynamic";

type AdminPaymentsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

function pageHref(filters: AdminPaymentFilters, page: number) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.provider) params.set("provider", filters.provider);
  if (filters.mode) params.set("mode", filters.mode);
  params.set("limit", String(filters.limit));
  params.set("page", String(page));
  return `/admin/payments?${params.toString()}`;
}

export default async function AdminPaymentsPage({ searchParams }: AdminPaymentsPageProps) {
  const access = await requireAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?notice=admin-auth-required");
  if (access.status !== "allowed") return <AdminAccessNotice page="dashboard" state={access} />;

  const filters = normalizeAdminPaymentFilters(await searchParams);
  let result: Awaited<ReturnType<typeof getAdminPaymentList>> | null = null;
  let error: string | null = null;
  try {
    result = await getAdminPaymentList(filters);
  } catch (caught) {
    error = caught instanceof PaymentError ? caught.message.trim() : "目前無法讀取付款準備資料。";
  }

  return (
    <>
      <section className="page-hero admin-member-hero">
        <div className="wrap">
          <p className="eyebrow">Admin Payments</p>
          <h1>付款準備查詢</h1>
          <p className="page-copy">唯讀頁面。第 16 階段沒有正式付款、退款、補點或商品解鎖功能。</p>
        </div>
      </section>

      <section className="section admin-member-section">
        <div className="wrap">
          <form className="cms-panel admin-order-filters admin-payment-filters" method="get" action="/admin/payments">
            <label>
              Session 狀態
              <select className="form-input" name="status" defaultValue={filters.status ?? ""}>
                <option value="">全部狀態</option>
                {PAYMENT_SESSION_STATUS_KEYS.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </label>
            <label>
              Provider
              <select className="form-input" name="provider" defaultValue={filters.provider ?? ""}>
                <option value="">全部 Provider</option>
                {PAYMENT_PROVIDER_KEYS.map((provider) => <option key={provider} value={provider}>{provider}</option>)}
              </select>
            </label>
            <label>
              Mode
              <select className="form-input" name="mode" defaultValue={filters.mode ?? ""}>
                <option value="">全部 Mode</option>
                {PAYMENT_MODE_KEYS.map((mode) => <option key={mode} value={mode}>{mode}</option>)}
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
              <Link className="btn secondary" href="/admin/payments">清除條件</Link>
            </div>
          </form>

          <div className="cms-panel admin-member-results">
            <div className="cms-library-head">
              <div><p className="eyebrow">Read only</p><h2>付款準備列表</h2></div>
              <span className="cms-pill">{result ? `${result.total} 筆` : "查詢中"}</span>
            </div>

            {error ? <p className="cms-empty" role="alert">{error}</p> : null}
            {!error && result?.payments.length === 0 ? <p className="cms-empty">目前沒有付款準備紀錄。正式 Checkout 尚未開放。</p> : null}
            {!error && result && result.payments.length > 0 ? (
              <div className="admin-member-table-wrap">
                <table className="admin-member-table admin-payment-table">
                  <thead><tr><th>訂單編號</th><th>會員 Email</th><th>Provider</th><th>Mode</th><th>狀態</th><th>金額</th><th>建立時間</th><th>詳細</th></tr></thead>
                  <tbody>
                    {result.payments.map((payment) => (
                      <tr key={payment.id}>
                        <td>{payment.order_number ?? "訂單已不存在"}</td>
                        <td>{payment.buyer_email ?? "未提供"}</td>
                        <td>{payment.provider}</td>
                        <td>{payment.mode}</td>
                        <td><PaymentStatusBadge status={payment.status} /></td>
                        <td>{formatOrderAmount(payment.amount_cents, payment.currency)}</td>
                        <td><time dateTime={payment.created_at}>{formatDate(payment.created_at)}</time></td>
                        <td><Link className="admin-member-detail-link" href={`/admin/payments/${payment.id}`}>查看</Link></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}

            {result && result.totalPages > 1 ? (
              <nav className="admin-member-pagination" aria-label="付款準備分頁">
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
