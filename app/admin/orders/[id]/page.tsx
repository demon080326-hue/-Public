import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminAccessNotice } from "@/components/admin-access-notice";
import { OrderStatusBadge } from "@/components/order-status-badge";
import { requireAdminAccess } from "@/lib/admin-access";
import { writeAdminAuditLog } from "@/lib/admin-audit-log";
import {
  formatOrderAmount,
  getAdminOrderById,
  isValidOrderId,
  OrderError,
  type AdminOrderDetail,
} from "@/lib/orders";

export const dynamic = "force-dynamic";

type AdminOrderDetailPageProps = {
  params: Promise<{ id: string }>;
};

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-TW", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Asia/Taipei",
  }).format(new Date(value));
}

function OrderLookupError({ message }: { message: string }) {
  return (
    <section className="section">
      <div className="wrap access-notice">
        <h1>無法讀取訂單</h1>
        <p>{message}</p>
        <Link className="btn secondary" href="/admin/orders">返回訂單列表</Link>
      </div>
    </section>
  );
}

export default async function AdminOrderDetailPage({ params }: AdminOrderDetailPageProps) {
  const access = await requireAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?notice=admin-auth-required");
  if (access.status !== "allowed") {
    return <AdminAccessNotice page="dashboard" state={access} />;
  }

  const { id } = await params;
  if (!isValidOrderId(id)) return <OrderLookupError message="訂單 ID 格式不正確。" />;

  let detail: AdminOrderDetail | null = null;
  let errorMessage: string | null = null;
  try {
    detail = await getAdminOrderById(id);
  } catch (caught) {
    errorMessage = caught instanceof OrderError ? caught.message : "目前無法讀取訂單資料。";
  }

  if (errorMessage) return <OrderLookupError message={errorMessage} />;
  if (!detail) return <OrderLookupError message="找不到訂單資料。" />;

  if (access.user && access.role) {
    const auditWritten = await writeAdminAuditLog({
      actor: { userId: access.user.id, email: access.user.email, role: access.role },
      action: "manual_admin_action",
      resourceType: "order",
      resourceId: detail.order.id,
      reason: "admin_order_detail_view",
      metadata: {
        stage: "stage15_orders",
        order_number: detail.order.order_number,
        source: "admin_order_page",
      },
    });
    if (!auditWritten) {
      console.error("Admin order page audit log was not written:", { orderId: detail.order.id });
    }
  }

  const { order, items, events } = detail;
  return (
    <>
      <section className="page-hero admin-member-hero">
        <div className="wrap">
          <p className="eyebrow">Order Detail</p>
          <h1>{order.order_number}</h1>
          <p className="page-copy">
            唯讀訂單詳細。此頁沒有付款、退款、出貨、點數或解鎖操作。
          </p>
        </div>
      </section>

      <section className="section admin-member-section">
        <div className="wrap admin-order-detail-grid">
          <article className="cms-panel">
            <div className="cms-library-head">
              <div><p className="eyebrow">Summary</p><h2>訂單資料</h2></div>
              <OrderStatusBadge kind="order" status={order.status} />
            </div>
            <dl className="member-profile-details">
              <div><dt>會員 Email</dt><dd>{order.buyer_email ?? "未提供"}</dd></div>
              <div><dt>訂單總額</dt><dd>{formatOrderAmount(order.total_cents, order.currency)}</dd></div>
              <div><dt>付款狀態</dt><dd><OrderStatusBadge kind="payment" status={order.payment_status} /></dd></div>
              <div><dt>履行狀態</dt><dd><OrderStatusBadge kind="fulfillment" status={order.fulfillment_status} /></dd></div>
              <div><dt>建立時間</dt><dd>{formatDate(order.created_at)}</dd></div>
              <div><dt>更新時間</dt><dd>{formatDate(order.updated_at)}</dd></div>
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
                    <div>
                      <strong>{item.product_name}</strong>
                      <small>{item.product_slug ?? "商品快照"}</small>
                    </div>
                    <span>{item.quantity} × {formatOrderAmount(item.unit_price_cents, order.currency)}</span>
                    <strong>{formatOrderAmount(item.total_cents, order.currency)}</strong>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <article className="cms-panel admin-order-events">
            <div className="cms-library-head">
              <div><p className="eyebrow">History</p><h2>訂單事件</h2></div>
              <span className="cms-pill">{events.length} 筆</span>
            </div>
            {events.length === 0 ? <p className="cms-empty">目前沒有訂單事件。</p> : (
              <ul className="order-event-list">
                {events.map((event) => (
                  <li key={event.id}>
                    <strong>{event.event_type}</strong>
                    <span>{event.reason ?? "未提供原因"}</span>
                    <time dateTime={event.created_at}>{formatDate(event.created_at)}</time>
                  </li>
                ))}
              </ul>
            )}
          </article>

          <div className="admin-order-actions">
            <Link className="btn secondary" href="/admin/orders">返回訂單列表</Link>
          </div>
        </div>
      </section>
    </>
  );
}
