import Link from "next/link";
import { redirect } from "next/navigation";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { getCurrentMemberContext, isSecurityAccessBlocked } from "@/lib/member-profile";
import {
  formatOrderAmount,
  getMemberOrderList,
  OrderError,
  type MemberOrderSummary,
} from "@/lib/orders";

export const dynamic = "force-dynamic";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

export default async function MemberOrdersPage() {
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
    return (
      <section className="section">
        <div className="wrap access-notice">
          <h1>會員訂單尚未開放</h1>
          <p>完成 Email 驗證並成為正式會員後，才能查看自己的訂單。</p>
          <Link className="btn secondary" href="/member">返回會員中心</Link>
        </div>
      </section>
    );
  }

  let orders: MemberOrderSummary[] = [];
  let error: string | null = null;
  try {
    orders = await getMemberOrderList(member.user.id);
  } catch (caught) {
    error = caught instanceof OrderError ? caught.message : "目前無法讀取你的訂單。";
  }

  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <p className="eyebrow">My Orders</p>
          <h1>我的訂單</h1>
          <p className="page-copy">
            這裡只顯示你的訂單。第 15 階段尚未開放正式購買與付款。
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="cms-panel">
            <div className="cms-library-head">
              <div><p className="eyebrow">Read only</p><h2>訂單紀錄</h2></div>
              <span className="cms-pill">{orders.length} 筆</span>
            </div>

            {error ? <p className="cms-empty" role="alert">{error}</p> : null}
            {!error && orders.length === 0 ? (
              <p className="cms-empty">你目前沒有訂單。商城購買功能仍暫未開放。</p>
            ) : null}
            {!error && orders.length > 0 ? (
              <div className="member-order-list">
                {orders.map((order) => (
                  <article className="member-order-card" key={order.id}>
                    <div>
                      <small>{formatDate(order.created_at)}</small>
                      <h2>{order.order_number}</h2>
                      <div className="member-order-badges">
                        <OrderStatusBadge kind="order" status={order.status} />
                        <OrderStatusBadge kind="payment" status={order.payment_status} />
                      </div>
                    </div>
                    <strong>{formatOrderAmount(order.total_cents, order.currency)}</strong>
                    <Link className="btn secondary" href={`/member/orders/${order.id}`}>
                      查看詳細
                    </Link>
                  </article>
                ))}
              </div>
            ) : null}

            <div className="admin-order-actions">
              <Link className="btn secondary" href="/member">返回會員中心</Link>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
