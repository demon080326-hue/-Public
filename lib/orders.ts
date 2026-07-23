import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import type {
  OrderEventRow,
  OrderItemRow,
  OrderPaymentStatus,
  OrderRow,
  OrderStatus,
} from "@/types/database";

const ADMIN_ORDER_FIELDS =
  "id,order_number,user_id,buyer_email,status,payment_status,fulfillment_status,currency,subtotal_cents,discount_cents,total_cents,points_earned,points_redeemed,payment_provider,payment_reference,note,created_at,updated_at";
const MEMBER_ORDER_FIELDS =
  "id,order_number,user_id,buyer_email,status,payment_status,fulfillment_status,currency,subtotal_cents,discount_cents,total_cents,points_earned,points_redeemed,created_at,updated_at";
const ADMIN_ORDER_ITEM_FIELDS =
  "id,order_id,product_id,product_name,product_slug,quantity,unit_price_cents,total_cents,created_at";
const ADMIN_ORDER_EVENT_FIELDS =
  "id,order_id,actor_user_id,event_type,before_data,after_data,reason,created_at";
const MEMBER_ORDER_EVENT_FIELDS = "id,order_id,event_type,reason,created_at";

export const ORDER_STATUS_KEYS: OrderStatus[] = [
  "draft",
  "pending_payment",
  "paid",
  "cancelled",
  "refunded",
  "fulfilled",
];
export const ORDER_PAYMENT_STATUS_KEYS: OrderPaymentStatus[] = [
  "unpaid",
  "pending",
  "paid",
  "failed",
  "refunded",
];

export type AdminOrderSummary = Omit<OrderRow, "metadata">;
export type MemberOrderSummary = Pick<
  OrderRow,
  | "id"
  | "order_number"
  | "user_id"
  | "buyer_email"
  | "status"
  | "payment_status"
  | "fulfillment_status"
  | "currency"
  | "subtotal_cents"
  | "discount_cents"
  | "total_cents"
  | "points_earned"
  | "points_redeemed"
  | "created_at"
  | "updated_at"
>;
export type OrderItemSummary = Omit<OrderItemRow, "metadata">;
export type AdminOrderEventSummary = Omit<OrderEventRow, "metadata">;
export type MemberOrderEventSummary = Pick<
  OrderEventRow,
  "id" | "order_id" | "event_type" | "reason" | "created_at"
>;

export type AdminOrderDetail = {
  order: AdminOrderSummary;
  items: OrderItemSummary[];
  events: AdminOrderEventSummary[];
};

export type MemberOrderDetail = {
  order: MemberOrderSummary;
  items: OrderItemSummary[];
  events: MemberOrderEventSummary[];
};

export type AdminOrderFilters = {
  search: string;
  status: OrderStatus | null;
  paymentStatus: OrderPaymentStatus | null;
  page: number;
  limit: number;
};

export type AdminOrderListResult = {
  orders: AdminOrderSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export class OrderError extends Error {
  constructor(
    public readonly code: "SERVICE_UNAVAILABLE" | "NOT_FOUND" | "QUERY_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "OrderError";
  }
}

function firstValue(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === "string" && ORDER_STATUS_KEYS.includes(value as OrderStatus);
}

function isOrderPaymentStatus(value: unknown): value is OrderPaymentStatus {
  return typeof value === "string" && ORDER_PAYMENT_STATUS_KEYS.includes(value as OrderPaymentStatus);
}

function escapeIlike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function isValidOrderId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeAdminOrderFilters(
  input: Record<string, string | string[] | undefined> | URLSearchParams,
): AdminOrderFilters {
  const read = (name: string) =>
    input instanceof URLSearchParams ? input.get(name) ?? undefined : firstValue(input[name]);
  const status = read("status");
  const paymentStatus = read("payment_status");

  return {
    search: (read("search") ?? "").replace(/[(),]/g, " ").trim().slice(0, 200),
    status: isOrderStatus(status) ? status : null,
    paymentStatus: isOrderPaymentStatus(paymentStatus) ? paymentStatus : null,
    page: Math.min(positiveInteger(read("page"), 1), 10_000),
    limit: Math.min(positiveInteger(read("limit"), 20), 50),
  };
}

export function formatOrderAmount(cents: number, currency = "TWD") {
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

export async function getAdminOrderList(filters: AdminOrderFilters): Promise<AdminOrderListResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new OrderError("SERVICE_UNAVAILABLE", "訂單服務目前無法使用。");

  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;
  let query = supabase
    .from("orders")
    .select(ADMIN_ORDER_FIELDS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.search) {
    const safe = escapeIlike(filters.search);
    query = query.or(`order_number.ilike.%${safe}%,buyer_email.ilike.%${safe}%`);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.paymentStatus) query = query.eq("payment_status", filters.paymentStatus);

  const { data, error, count } = await query;
  if (error) {
    console.error("Admin order list query failed:", { code: error.code, message: error.message });
    throw new OrderError("QUERY_FAILED", "無法查詢訂單資料。");
  }

  const total = count ?? 0;
  return {
    orders: (data ?? []) as unknown as AdminOrderSummary[],
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
  };
}

export async function getAdminOrderById(id: string): Promise<AdminOrderDetail | null> {
  if (!isValidOrderId(id)) return null;

  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new OrderError("SERVICE_UNAVAILABLE", "訂單服務目前無法使用。");

  const [orderResult, itemsResult, eventsResult] = await Promise.all([
    supabase.from("orders").select(ADMIN_ORDER_FIELDS).eq("id", id).maybeSingle(),
    supabase.from("order_items").select(ADMIN_ORDER_ITEM_FIELDS).eq("order_id", id).order("created_at"),
    supabase
      .from("order_events")
      .select(ADMIN_ORDER_EVENT_FIELDS)
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (orderResult.error || itemsResult.error || eventsResult.error) {
    const error = orderResult.error ?? itemsResult.error ?? eventsResult.error;
    console.error("Admin order detail query failed:", { code: error?.code, message: error?.message });
    throw new OrderError("QUERY_FAILED", "無法讀取訂單詳細資料。");
  }
  if (!orderResult.data) return null;

  return {
    order: orderResult.data as unknown as AdminOrderSummary,
    items: (itemsResult.data ?? []) as unknown as OrderItemSummary[],
    events: (eventsResult.data ?? []) as unknown as AdminOrderEventSummary[],
  };
}

export async function getMemberOrderList(userId: string, limit = 50): Promise<MemberOrderSummary[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new OrderError("SERVICE_UNAVAILABLE", "訂單服務目前無法使用。");

  const { data, error } = await supabase
    .from("orders")
    .select(MEMBER_ORDER_FIELDS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(Math.min(Math.max(Math.trunc(limit), 1), 100));

  if (error) {
    console.error("Member order list query failed:", { code: error.code, message: error.message });
    throw new OrderError("QUERY_FAILED", "無法讀取你的訂單。");
  }

  return (data ?? []) as unknown as MemberOrderSummary[];
}

export async function getMemberOrderById(userId: string, id: string): Promise<MemberOrderDetail | null> {
  if (!isValidOrderId(id)) return null;

  const supabase = await getSupabaseServerClient();
  if (!supabase) throw new OrderError("SERVICE_UNAVAILABLE", "訂單服務目前無法使用。");

  const { data: order, error: orderError } = await supabase
    .from("orders")
    .select(MEMBER_ORDER_FIELDS)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();

  if (orderError) {
    console.error("Member order detail query failed:", { code: orderError.code, message: orderError.message });
    throw new OrderError("QUERY_FAILED", "無法讀取你的訂單。");
  }
  if (!order) return null;

  const [itemsResult, eventsResult] = await Promise.all([
    supabase.from("order_items").select(ADMIN_ORDER_ITEM_FIELDS).eq("order_id", id).order("created_at"),
    supabase
      .from("order_events")
      .select(MEMBER_ORDER_EVENT_FIELDS)
      .eq("order_id", id)
      .order("created_at", { ascending: false }),
  ]);

  if (itemsResult.error || eventsResult.error) {
    const error = itemsResult.error ?? eventsResult.error;
    console.error("Member order child query failed:", { code: error?.code, message: error?.message });
    throw new OrderError("QUERY_FAILED", "無法讀取你的訂單詳細資料。");
  }

  return {
    order: order as unknown as MemberOrderSummary,
    items: (itemsResult.data ?? []) as unknown as OrderItemSummary[],
    events: (eventsResult.data ?? []) as unknown as MemberOrderEventSummary[],
  };
}
