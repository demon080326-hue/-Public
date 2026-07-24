import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import {
  PAYMENT_SESSION_STATUS_KEYS,
  isPaymentSessionStatus,
} from "@/lib/payment-state";
import type {
  PaymentEventRow,
  PaymentMode,
  PaymentProvider,
  PaymentSessionRow,
  PaymentWebhookEventRow,
} from "@/types/database";

const ADMIN_PAYMENT_SESSION_FIELDS =
  "id,order_id,user_id,provider,mode,status,amount_cents,currency,expires_at,created_at,updated_at";
const ADMIN_PAYMENT_EVENT_FIELDS =
  "id,payment_session_id,order_id,event_type,before_status,after_status,amount_cents,provider,provider_event_id,reason,created_at";
const ADMIN_WEBHOOK_EVENT_FIELDS =
  "id,provider,provider_event_id,event_type,received_at,processed_at,status,order_id,payment_session_id,error_message";

const PAYMENT_PROVIDER_KEYS: PaymentProvider[] = ["disabled", "mock", "ecpay", "line_pay", "manual"];
const PAYMENT_MODE_KEYS: PaymentMode[] = ["disabled", "test", "live"];

export type AdminPaymentSummary = Pick<
  PaymentSessionRow,
  | "id"
  | "order_id"
  | "user_id"
  | "provider"
  | "mode"
  | "status"
  | "amount_cents"
  | "currency"
  | "expires_at"
  | "created_at"
  | "updated_at"
> & {
  order_number: string | null;
  buyer_email: string | null;
};

export type AdminPaymentDetail = {
  payment: AdminPaymentSummary;
  events: Pick<
    PaymentEventRow,
    | "id"
    | "payment_session_id"
    | "order_id"
    | "event_type"
    | "before_status"
    | "after_status"
    | "amount_cents"
    | "provider"
    | "provider_event_id"
    | "reason"
    | "created_at"
  >[];
  webhookEvents: Pick<
    PaymentWebhookEventRow,
    | "id"
    | "provider"
    | "provider_event_id"
    | "event_type"
    | "received_at"
    | "processed_at"
    | "status"
    | "order_id"
    | "payment_session_id"
    | "error_message"
  >[];
};

export type AdminPaymentFilters = {
  status: PaymentSessionRow["status"] | null;
  provider: PaymentProvider | null;
  mode: PaymentMode | null;
  page: number;
  limit: number;
};

export type AdminPaymentListResult = {
  payments: AdminPaymentSummary[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export class PaymentError extends Error {
  constructor(
    public readonly code: "SERVICE_UNAVAILABLE" | "QUERY_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "PaymentError";
  }
}

function firstValue(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function isPaymentProvider(value: unknown): value is PaymentProvider {
  return typeof value === "string" && PAYMENT_PROVIDER_KEYS.includes(value as PaymentProvider);
}

function isPaymentMode(value: unknown): value is PaymentMode {
  return typeof value === "string" && PAYMENT_MODE_KEYS.includes(value as PaymentMode);
}

export function isValidPaymentSessionId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export function normalizeAdminPaymentFilters(
  input: Record<string, string | string[] | undefined> | URLSearchParams,
): AdminPaymentFilters {
  const read = (name: string) =>
    input instanceof URLSearchParams ? input.get(name) ?? undefined : firstValue(input[name]);
  const status = read("status");
  const provider = read("provider");
  const mode = read("mode");

  return {
    status: isPaymentSessionStatus(status) ? status : null,
    provider: isPaymentProvider(provider) ? provider : null,
    mode: isPaymentMode(mode) ? mode : null,
    page: Math.min(positiveInteger(read("page"), 1), 10_000),
    limit: Math.min(positiveInteger(read("limit"), 20), 50),
  };
}

async function getOrderContext(orderIds: string[]) {
  if (orderIds.length === 0) return new Map<string, { order_number: string | null; buyer_email: string | null }>();

  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new PaymentError("SERVICE_UNAVAILABLE", "付款服務目前無法使用。");
  const { data, error } = await supabase
    .from("orders")
    .select("id,order_number,buyer_email")
    .in("id", orderIds);

  if (error) {
    console.error("Payment order context query failed:", { code: error.code, message: error.message });
    throw new PaymentError("QUERY_FAILED", "無法讀取付款對應訂單。");
  }

  return new Map((data ?? []).map((order) => [
    order.id,
    { order_number: order.order_number, buyer_email: order.buyer_email },
  ]));
}

function withOrderContext(
  rows: Pick<
    PaymentSessionRow,
    | "id"
    | "order_id"
    | "user_id"
    | "provider"
    | "mode"
    | "status"
    | "amount_cents"
    | "currency"
    | "expires_at"
    | "created_at"
    | "updated_at"
  >[],
  orders: Map<string, { order_number: string | null; buyer_email: string | null }>,
): AdminPaymentSummary[] {
  return rows.map((row) => ({
    ...row,
    order_number: orders.get(row.order_id)?.order_number ?? null,
    buyer_email: orders.get(row.order_id)?.buyer_email ?? null,
  }));
}

export async function getAdminPaymentList(filters: AdminPaymentFilters): Promise<AdminPaymentListResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new PaymentError("SERVICE_UNAVAILABLE", "付款服務目前無法使用。");

  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;
  let query = supabase
    .from("payment_sessions")
    .select(ADMIN_PAYMENT_SESSION_FIELDS, { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.status) query = query.eq("status", filters.status);
  if (filters.provider) query = query.eq("provider", filters.provider);
  if (filters.mode) query = query.eq("mode", filters.mode);

  const { data, error, count } = await query;
  if (error) {
    console.error("Admin payment list query failed:", { code: error.code, message: error.message });
    throw new PaymentError("QUERY_FAILED", "無法查詢付款準備資料。");
  }

  const rows = (data ?? []) as unknown as Parameters<typeof withOrderContext>[0];
  const orderContext = await getOrderContext([...new Set(rows.map((row) => row.order_id))]);
  const total = count ?? 0;

  return {
    payments: withOrderContext(rows, orderContext),
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
  };
}

export async function getAdminPaymentById(id: string): Promise<AdminPaymentDetail | null> {
  if (!isValidPaymentSessionId(id)) return null;

  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new PaymentError("SERVICE_UNAVAILABLE", "付款服務目前無法使用。");

  const [paymentResult, eventsResult, webhookEventsResult] = await Promise.all([
    supabase.from("payment_sessions").select(ADMIN_PAYMENT_SESSION_FIELDS).eq("id", id).maybeSingle(),
    supabase.from("payment_events").select(ADMIN_PAYMENT_EVENT_FIELDS).eq("payment_session_id", id).order("created_at", { ascending: false }),
    supabase.from("payment_webhook_events").select(ADMIN_WEBHOOK_EVENT_FIELDS).eq("payment_session_id", id).order("received_at", { ascending: false }),
  ]);

  if (paymentResult.error || eventsResult.error || webhookEventsResult.error) {
    const error = paymentResult.error ?? eventsResult.error ?? webhookEventsResult.error;
    console.error("Admin payment detail query failed:", { code: error?.code, message: error?.message });
    throw new PaymentError("QUERY_FAILED", "無法讀取付款準備詳細資料。");
  }
  if (!paymentResult.data) return null;

  const paymentRow = paymentResult.data as unknown as Parameters<typeof withOrderContext>[0][number];
  const orderContext = await getOrderContext([paymentRow.order_id]);

  return {
    payment: withOrderContext([paymentRow], orderContext)[0],
    events: (eventsResult.data ?? []) as unknown as AdminPaymentDetail["events"],
    webhookEvents: (webhookEventsResult.data ?? []) as unknown as AdminPaymentDetail["webhookEvents"],
  };
}

export { PAYMENT_PROVIDER_KEYS, PAYMENT_MODE_KEYS, PAYMENT_SESSION_STATUS_KEYS };
