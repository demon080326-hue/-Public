import type {
  OrderFulfillmentStatus,
  OrderPaymentStatus,
  OrderStatus,
} from "@/types/database";

const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  draft: "草稿",
  pending_payment: "待付款",
  paid: "已付款",
  cancelled: "已取消",
  refunded: "已退款",
  fulfilled: "已完成",
};

const PAYMENT_STATUS_LABELS: Record<OrderPaymentStatus, string> = {
  unpaid: "未付款",
  pending: "付款處理中",
  paid: "已付款",
  failed: "付款失敗",
  refunded: "已退款",
};

const FULFILLMENT_STATUS_LABELS: Record<OrderFulfillmentStatus, string> = {
  unfulfilled: "未履行",
  partial: "部分履行",
  fulfilled: "已履行",
  cancelled: "已取消",
};

type OrderStatusBadgeProps =
  | { kind: "order"; status: OrderStatus }
  | { kind: "payment"; status: OrderPaymentStatus }
  | { kind: "fulfillment"; status: OrderFulfillmentStatus };

export function OrderStatusBadge(props: OrderStatusBadgeProps) {
  const label =
    props.kind === "order"
      ? ORDER_STATUS_LABELS[props.status]
      : props.kind === "payment"
        ? PAYMENT_STATUS_LABELS[props.status]
        : FULFILLMENT_STATUS_LABELS[props.status];

  return (
    <span className={`order-status-badge order-status-${props.status}`}>
      {label}
    </span>
  );
}
