import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminAccessNotice } from "@/components/admin-access-notice";
import { PaymentStatusBadge } from "@/components/payment-status-badge";
import { requireAdminAccess } from "@/lib/admin-access";
import { formatOrderAmount } from "@/lib/orders";
import { getAdminPaymentById, isValidPaymentSessionId, PaymentError } from "@/lib/payments";

export const dynamic = "force-dynamic";

type AdminPaymentDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

function PaymentLookupError({ message }: { message: string }) {
  return (
    <section className="section"><div className="wrap access-notice"><h1>無法讀取付款準備</h1><p>{message}</p><Link className="btn secondary" href="/admin/payments">返回付款準備列表</Link></div></section>
  );
}

export default async function AdminPaymentDetailPage({ params }: AdminPaymentDetailPageProps) {
  const access = await requireAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?notice=admin-auth-required");
  if (access.status !== "allowed") return <AdminAccessNotice page="dashboard" state={access} />;

  const { id } = await params;
  if (!isValidPaymentSessionId(id)) return <PaymentLookupError message="付款準備 ID 格式不正確。" />;

  let detail: Awaited<ReturnType<typeof getAdminPaymentById>> | null = null;
  let error: string | null = null;
  try {
    detail = await getAdminPaymentById(id);
  } catch (caught) {
    error = caught instanceof PaymentError ? caught.message.trim() : "目前無法讀取付款準備資料。";
  }
  if (error) return <PaymentLookupError message={error} />;
  if (!detail) return <PaymentLookupError message="找不到付款準備資料。" />;

  const { payment, events, webhookEvents } = detail;
  return (
    <>
      <section className="page-hero admin-member-hero">
        <div className="wrap"><p className="eyebrow">Payment Detail</p><h1>{payment.order_number ?? payment.order_id}</h1><p className="page-copy">唯讀付款準備詳細。本頁不能改成已付款、退款、補點或解鎖商品。</p></div>
      </section>
      <section className="section admin-member-section">
        <div className="wrap admin-order-detail-grid">
          <article className="cms-panel">
            <div className="cms-library-head"><div><p className="eyebrow">Summary</p><h2>付款準備資料</h2></div><PaymentStatusBadge status={payment.status} /></div>
            <dl className="member-profile-details">
              <div><dt>訂單編號</dt><dd>{payment.order_number ?? "訂單已不存在"}</dd></div>
              <div><dt>會員 Email</dt><dd>{payment.buyer_email ?? "未提供"}</dd></div>
              <div><dt>Provider / Mode</dt><dd>{payment.provider} / {payment.mode}</dd></div>
              <div><dt>金額</dt><dd>{formatOrderAmount(payment.amount_cents, payment.currency)}</dd></div>
              <div><dt>建立時間</dt><dd>{formatDate(payment.created_at)}</dd></div>
            </dl>
          </article>

          <article className="cms-panel admin-order-events">
            <div className="cms-library-head"><div><p className="eyebrow">Payment events</p><h2>付款事件</h2></div><span className="cms-pill">{events.length} 筆</span></div>
            {events.length === 0 ? <p className="cms-empty">目前沒有付款事件。</p> : <ul className="order-event-list">{events.map((event) => <li key={event.id}><strong>{event.event_type}</strong><span>{event.reason ?? "狀態紀錄"}</span><time dateTime={event.created_at}>{formatDate(event.created_at)}</time></li>)}</ul>}
          </article>

          <article className="cms-panel admin-order-events">
            <div className="cms-library-head"><div><p className="eyebrow">Webhook events</p><h2>Webhook 冪等紀錄</h2></div><span className="cms-pill">{webhookEvents.length} 筆</span></div>
            {webhookEvents.length === 0 ? <p className="cms-empty">目前沒有 webhook 紀錄。本階段沒有正式 webhook。</p> : <ul className="order-event-list">{webhookEvents.map((event) => <li key={event.id}><strong>{event.event_type}</strong><span>{event.status}</span><time dateTime={event.received_at}>{formatDate(event.received_at)}</time></li>)}</ul>}
          </article>

          <div className="admin-order-actions"><Link className="btn secondary" href="/admin/payments">返回付款準備列表</Link></div>
        </div>
      </section>
    </>
  );
}
