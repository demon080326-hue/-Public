import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { getCurrentMemberContext, isSecurityAccessBlocked } from "@/lib/member-profile";
import { formatOrderAmount, getMemberOrderById, isValidOrderId, OrderError } from "@/lib/orders";

export const dynamic = "force-dynamic";

type MemberOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

export default async function MemberOrderDetailPage({ params }: MemberOrderDetailPageProps) {
  const member = await getCurrentMemberContext({ syncProfileFromAuth: true });
  if (!member) redirect("/login");
  if (isSecurityAccessBlocked(member)) {
    redirect(member.securityState?.requires_reverification
      ? "/login?notice=reverification-required"
      : "/login?error=auth-unavailable");
  }
  if (
    member.profileStatus !== "ready"
    || !member.profile
    || member.profile.role === "pending_member"
    || !member.user.emailVerified
    || !member.profile.email_verified
  ) {
    redirect("/member/orders");
  }

  const { id } = await params;
  if (!isValidOrderId(id)) notFound();

  let detail;
  try {
    detail = await getMemberOrderById(member.user.id, id);
  } catch (caught) {
    const message = caught instanceof OrderError ? caught.message : "目前無法讀取你的訂單。";
    return (
      <section className="section">
        <div className="wrap access-notice">
          <h1>無法讀取訂單</h1>
          <p>{message}</p>
          <Link className="btn secondary" href="/member/orders">返回我的訂單</Link>
        </div>
      </section>
    );
  }
  if (!detail) notFound();

  const { order, items, events } = detail;
  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <p className="eyebrow">Order Detail</p>
          <h1>{order.order_number}</h1>
          <p className="page-copy">只顯示你自己的訂單資料。</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap admin-order-detail-grid">
          <article className="cms-panel">
            <div className="cms-library-head">
              <div><p className="eyebrow">Summary</p><h2>訂單狀態</h2></div>
              <OrderStatusBadge kind="order" status={order.status} />
            </div>
            <dl className="member-profile-details">
              <div><dt>訂單總額</dt><dd>{formatOrderAmount(order.total_cents, order.currency)}</dd></div>
              <div><dt>付款狀態</dt><dd><OrderStatusBadge kind="payment" status={order.payment_status} /></dd></div>
              <div><dt>履行狀態</dt><dd><OrderStatusBadge kind="fulfillment" status={order.fulfillment_status} /></dd></div>
              <div><dt>建立時間</dt><dd>{formatDate(order.created_at)}</dd></div>
            </dl>
          </article>

          <article className="cms-panel">
            <div className="cms-library-head">
              <div><p className="eyebrow">Items</p><h2>訂單項目</h2></div>
              <span className="cms-pill">{items.length} 項</span>
            </div>
            {items.length === 0 ? <p className="cms-empty">這筆訂單目前沒有項目。</p> : (
              <ul className="order-item-list">
                {items.map((item) => (
                  <li key={item.id}>
                    <div><strong>{item.product_name}</strong><small>{item.product_slug ?? "商品快照"}</small></div>
                    <span>{item.quantity} × {formatOrderAmount(item.unit_price_cents, order.currency)}</span>
                    <strong>{formatOrderAmount(item.total_cents, order.currency)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="cms-panel admin-order-events">
            <div className="cms-library-head">
              <div><p className="eyebrow">History</p><h2>訂單紀錄</h2></div>
              <span className="cms-pill">{events.length} 筆</span>
            </div>
            {events.length === 0 ? <p className="cms-empty">目前沒有訂單事件。</p> : (
              <ul className="order-event-list">
                {events.map((event) => (
                  <li key={event.id}>
                    <strong>{event.event_type}</strong>
                    <span>{event.reason ?? "狀態紀錄"}</span>
                    <time dateTime={event.created_at}>{formatDate(event.created_at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <div className="admin-order-actions">
            <Link className="btn secondary" href="/member/orders">返回我的訂單</Link>
          </div>
        </div>
      </section>
    </>
  );
}
