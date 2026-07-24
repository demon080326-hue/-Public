import type { PaymentSessionStatus } from "@/types/database";

export const PAYMENT_SESSION_STATUS_KEYS: PaymentSessionStatus[] = [
  "created",
  "pending",
  "authorized",
  "paid",
  "failed",
  "cancelled",
  "expired",
  "refunded",
];

const PAYMENT_SESSION_STATUS_LABELS: Record<PaymentSessionStatus, string> = {
  created: "已建立",
  pending: "付款處理中",
  authorized: "已授權",
  paid: "已付款",
  failed: "付款失敗",
  cancelled: "已取消",
  expired: "已過期",
  refunded: "已退款",
};

const PAYMENT_SESSION_TRANSITIONS: Record<PaymentSessionStatus, PaymentSessionStatus[]> = {
  created: ["pending", "cancelled"],
  pending: ["paid", "failed", "expired"],
  authorized: ["paid", "cancelled", "expired"],
  paid: ["refunded"],
  failed: [],
  cancelled: [],
  expired: [],
  refunded: [],
};

export function isPaymentSessionStatus(value: unknown): value is PaymentSessionStatus {
  return typeof value === "string" && PAYMENT_SESSION_STATUS_KEYS.includes(value as PaymentSessionStatus);
}

export function getPaymentSessionStatusLabel(status: PaymentSessionStatus) {
  return PAYMENT_SESSION_STATUS_LABELS[status];
}

export function canTransitionPaymentSession(
  from: PaymentSessionStatus,
  to: PaymentSessionStatus,
) {
  return PAYMENT_SESSION_TRANSITIONS[from].includes(to);
}

export function isStage16AllowedPaymentStatus(status: PaymentSessionStatus) {
  return status === "created" || status === "pending" || status === "cancelled" || status === "expired" || status === "failed";
}
