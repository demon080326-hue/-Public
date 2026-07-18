import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const EMAIL_OTP_TYPES = new Set<EmailOtpType>([
  "email",
  "email_change",
  "invite",
  "magiclink",
  "recovery",
  "signup",
]);

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/member";
  if (value === "/dashboard" || value.startsWith("/admin")) return "/member";
  return value;
}

function noStoreRedirect(url: URL, status: 303 | 307 = 307) {
  const response = NextResponse.redirect(url, status);
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

function logCallbackFailure(stage: string, error?: unknown) {
  const authError = error && typeof error === "object"
    ? error as { code?: unknown; status?: unknown; name?: unknown; message?: unknown }
    : null;

  console.error("Auth callback failed", {
    stage,
    code: typeof authError?.code === "string" ? authError.code : "unknown",
    status: typeof authError?.status === "number" ? authError.status : null,
    name: typeof authError?.name === "string" ? authError.name : null,
    message: typeof authError?.message === "string" ? authError.message.slice(0, 240) : null,
  });
}

function parseOtpType(value: string | null): EmailOtpType | null {
  return value && EMAIL_OTP_TYPES.has(value as EmailOtpType) ? value as EmailOtpType : null;
}

async function completeAuthCallback({
  requestUrl,
  code,
  tokenHash,
  type,
  redirectStatus,
}: {
  requestUrl: URL;
  code: string | null;
  tokenHash: string | null;
  type: EmailOtpType | null;
  redirectStatus: 303 | 307;
}) {
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));
  const loginUrl = new URL("/login", requestUrl.origin);

  if (!code && !(tokenHash && type)) {
    logCallbackFailure("missing_credentials");
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return noStoreRedirect(loginUrl, redirectStatus);
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    logCallbackFailure("supabase_unavailable");
    loginUrl.searchParams.set("error", "auth-unavailable");
    return noStoreRedirect(loginUrl, redirectStatus);
  }

  const { error } = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : await supabase.auth.verifyOtp({ token_hash: tokenHash!, type: type! });

  if (error) {
    logCallbackFailure(code ? "exchange_code" : "verify_token_hash", error);
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return noStoreRedirect(loginUrl, redirectStatus);
  }

  return noStoreRedirect(new URL(nextPath, requestUrl.origin), redirectStatus);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  return completeAuthCallback({
    requestUrl,
    code: requestUrl.searchParams.get("code"),
    tokenHash: requestUrl.searchParams.get("token_hash"),
    type: parseOtpType(requestUrl.searchParams.get("type")),
    redirectStatus: 307,
  });
}

export async function POST(request: Request) {
  const requestUrl = new URL(request.url);
  const formData = await request.formData();
  requestUrl.searchParams.set("next", String(formData.get("next") ?? "/member"));

  return completeAuthCallback({
    requestUrl,
    code: null,
    tokenHash: typeof formData.get("token_hash") === "string" ? String(formData.get("token_hash")) : null,
    type: parseOtpType(typeof formData.get("type") === "string" ? String(formData.get("type")) : null),
    redirectStatus: 303,
  });
}
