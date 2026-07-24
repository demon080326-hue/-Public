import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckoutDisabledNotice } from "@/components/checkout-disabled-notice";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { getCurrentMemberContext, isSecurityAccessBlocked } from "@/lib/member-profile";
import { formatOrderAmount, getMemberOrderById, isValidOrderId, OrderError } from "@/lib/orders";

export const dynamic = "force-dynamic";

type CheckoutPageProps = {
  params: Promise<{ orderId: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

export default async function CheckoutPage({ params }: CheckoutPageProps) {
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

  const { orderId } = await params;
  if (!isValidOrderId(orderId)) notFound();

  let detail;
  try {
    detail = await getMemberOrderById(member.user.id, orderId);
  } catch (error) {
    const message = error instanceof OrderError ? error.message : "目前無法讀取訂單資料。";
    return (
      <section className="section">
        <div className="wrap access-notice">
          <h1>無法準備付款頁</h1>
          <p>{message}</p>
          <Link className="btn secondary" href="/member/orders">回會員訂單</Link>
        </div>
      </section>
    );
  }
  if (!detail) notFound();

  const { order, items } = detail;
  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <p className="eyebrow">Checkout Preparation</p>
          <h1>付款準備</h1>
          <p className="page-copy">訂單編號：{order.order_number}</p>
        </div>
      </section>

      <section className="section">
        <div className="wrap checkout-layout">
          <CheckoutDisabledNotice />

          <article className="cms-panel">
            <div className="cms-library-head">
              <div><p className="eyebrow">Order summary</p><h2>訂單資訊</h2></div>
              <OrderStatusBadge kind="order" status={order.status} />
            </div>
            <dl className="member-profile-details">
              <div><dt>訂單金額</dt><dd>{formatOrderAmount(order.total_cents, order.currency)}</dd></div>
              <div><dt>付款狀態</dt><dd><OrderStatusBadge kind="payment" status={order.payment_status} /></dd></div>
              <div><dt>建立時間</dt><dd>{formatDate(order.created_at)}</dd></div>
            </dl>
          </article>

          <article className="cms-panel">
            <div className="cms-library-head">
              <div><p className="eyebrow">Items</p><h2>商品項目</h2></div>
              <span className="cms-pill">{items.length} 項</span>
            </div>
            {items.length === 0 ? <p className="cms-empty">這筆訂單目前沒有商品項目。</p> : (
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

          <div className="admin-order-actions">
            <Link className="btn secondary" href="/member/orders">回會員訂單</Link>
          </div>
        </div>
      </section>
    </>
  );
}
