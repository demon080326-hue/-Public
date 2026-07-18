import "server-only";

import { createHash } from "node:crypto";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type { AuthSecurityStateRow, Json } from "@/types/database";

type SecurityOperationResult = {
  ok: boolean;
  state?: AuthSecurityStateRow | null;
};

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export type ReverificationTarget = {
  userId: string;
  requiresReverification: boolean;
};

function getRequestIpHash(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim();
  return ip ? sha256(ip) : null;
}

function getRequestUserAgent(request: Request) {
  return request.headers.get("user-agent")?.slice(0, 512) || null;
}

async function readSecurityState(userId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false } satisfies SecurityOperationResult;

  const { data, error } = await admin
    .from("auth_security_state")
    .select("user_id, failed_login_count, requires_reverification, locked_until, last_failed_login_at, last_successful_login_at, created_at, updated_at")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    console.error("Auth security state read failed:", error.message);
    return { ok: false } satisfies SecurityOperationResult;
  }

  return { ok: true, state: data } satisfies SecurityOperationResult;
}

export async function recordLoginFailure(request: Request, email: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false } satisfies SecurityOperationResult;

  const { error } = await admin.rpc("record_login_failure", {
    p_email_hash: sha256(normalizeEmail(email)),
    p_ip_hash: getRequestIpHash(request),
    p_user_agent: getRequestUserAgent(request),
    p_reason: "invalid_credentials",
  });

  if (error) {
    console.error("Login failure recording failed:", error.message);
    return { ok: false } satisfies SecurityOperationResult;
  }

  return { ok: true } satisfies SecurityOperationResult;
}

export async function recordLoginSuccess(request: Request, userId: string, email: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false } satisfies SecurityOperationResult;

  const { error } = await admin.rpc("record_login_success", {
    p_user_id: userId,
    p_email_hash: sha256(normalizeEmail(email)),
    p_ip_hash: getRequestIpHash(request),
    p_user_agent: getRequestUserAgent(request),
  });

  if (error) {
    console.error("Login success recording failed:", error.message);
    return { ok: false } satisfies SecurityOperationResult;
  }

  return readSecurityState(userId);
}

export async function getAuthSecurityState(userId: string) {
  return readSecurityState(userId);
}

export async function clearReverification(userId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false } satisfies SecurityOperationResult;

  const { error } = await admin.rpc("clear_reverification", { p_user_id: userId });
  if (error) {
    console.error("Reverification clearing failed:", error.message);
    return { ok: false } satisfies SecurityOperationResult;
  }

  return readSecurityState(userId);
}

export async function recordAuthSecurityEvent(userId: string, eventType: string, metadata: Json = {}) {
  const admin = getSupabaseAdminClient();
  if (!admin) return false;

  const { error } = await admin.rpc("record_auth_security_event", {
    p_user_id: userId,
    p_event_type: eventType,
    p_metadata: metadata,
  });

  if (error) {
    console.error("Auth security event recording failed:", error.message);
    return false;
  }

  return true;
}

export async function getReverificationTarget(email: string): Promise<ReverificationTarget | null> {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.rpc("get_reverification_target", {
    p_email_hash: sha256(normalizeEmail(email)),
  });

  if (error) {
    console.error("Reverification target lookup failed:", error.message);
    return null;
  }

  const target = data?.[0];
  if (!target) return null;

  return {
    userId: target.target_user_id,
    requiresReverification: target.requires_reverification,
  };
}

export async function createReverificationCode(userId: string, plainCode: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return null;

  const { data, error } = await admin.rpc("create_email_verification_code", {
    p_user_id: userId,
    p_purpose: "login_reverification",
    p_plain_code: plainCode,
  });

  if (error) {
    console.error("Reverification code creation failed:", error.message);
    return null;
  }

  return data;
}

export async function cancelReverificationCode(codeId: string, userId: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return false;

  const { data, error } = await admin.rpc("cancel_email_verification_code", {
    p_code_id: codeId,
    p_user_id: userId,
    p_purpose: "login_reverification",
  });

  if (error) {
    console.error("Reverification code cancellation failed:", error.message);
    return false;
  }

  return data === true;
}

export async function verifyReverificationCode(userId: string, plainCode: string) {
  const admin = getSupabaseAdminClient();
  if (!admin) return { ok: false, verified: false };

  const { data, error } = await admin.rpc("verify_email_verification_code", {
    p_user_id: userId,
    p_purpose: "login_reverification",
    p_plain_code: plainCode,
  });

  if (error) {
    console.error("Reverification code verification failed:", error.message);
    return { ok: false, verified: false };
  }

  return { ok: true, verified: data === true };
}
