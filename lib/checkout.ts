import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { isValidOrderId } from "@/lib/orders";
import type { PaymentSessionRow } from "@/types/database";

const PAYMENT_SESSION_FIELDS =
  "id,order_id,user_id,provider,mode,status,amount_cents,currency,expires_at,created_at,updated_at";

export class CheckoutError extends Error {
  constructor(
    public readonly code:
      | "SERVICE_UNAVAILABLE"
      | "INVALID_ORDER_ID"
      | "ORDER_NOT_FOUND"
      | "ORDER_FORBIDDEN"
      | "ORDER_NOT_ELIGIBLE"
      | "SESSION_CREATE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "CheckoutError";
  }
}

function checkoutErrorFromRpc(error: { message?: string | null }) {
  switch (error.message) {
    case "CHECKOUT_ORDER_NOT_FOUND":
      return new CheckoutError("ORDER_NOT_FOUND", "找不到這筆訂單。");
    case "CHECKOUT_ORDER_FORBIDDEN":
      return new CheckoutError("ORDER_FORBIDDEN", "你沒有建立這筆訂單付款準備的權限。");
    case "CHECKOUT_ORDER_NOT_ELIGIBLE":
      return new CheckoutError("ORDER_NOT_ELIGIBLE", "這筆訂單目前不能建立付款準備。");
    case "CHECKOUT_INVALID_INPUT":
      return new CheckoutError("INVALID_ORDER_ID", "訂單 ID 格式不正確。");
    default:
      return new CheckoutError("SESSION_CREATE_FAILED", "目前無法建立付款準備。");
  }
}

export async function createDisabledCheckoutSession(input: {
  orderId: string;
  userId: string;
}) {
  if (!isValidOrderId(input.orderId)) {
    throw new CheckoutError("INVALID_ORDER_ID", "訂單 ID 格式不正確。");
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    throw new CheckoutError("SERVICE_UNAVAILABLE", "付款服務目前無法使用。");
  }

  const { data: created, error: createError } = await supabase.rpc(
    "create_disabled_checkout_session",
    { p_order_id: input.orderId, p_user_id: input.userId },
  );

  if (createError) {
    console.error("Disabled checkout session RPC failed:", {
      code: createError.code,
      message: createError.message,
    });
    throw checkoutErrorFromRpc(createError);
  }

  const result = created?.[0];
  if (!result?.payment_session_id) {
    throw new CheckoutError("SESSION_CREATE_FAILED", "目前無法建立付款準備。");
  }

  const { data: session, error: sessionError } = await supabase
    .from("payment_sessions")
    .select(PAYMENT_SESSION_FIELDS)
    .eq("id", result.payment_session_id)
    .maybeSingle();

  if (sessionError || !session) {
    console.error("Disabled checkout session lookup failed:", {
      code: sessionError?.code,
      message: sessionError?.message,
    });
    throw new CheckoutError("SESSION_CREATE_FAILED", "付款準備已建立，但暫時無法讀取資料。");
  }

  return {
    session: session as unknown as Pick<
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
    >,
    wasCreated: result.was_created === true,
  };
}
