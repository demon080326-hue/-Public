import { NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabase/server";

function safeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return "/member";
  if (value === "/dashboard" || value.startsWith("/admin")) return "/member";
  return value;
}

function noStoreRedirect(url: URL) {
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-cache, no-store, must-revalidate, max-age=0");
  response.headers.set("Expires", "0");
  response.headers.set("Pragma", "no-cache");
  return response;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = safeNextPath(requestUrl.searchParams.get("next"));
  const loginUrl = new URL("/login", requestUrl.origin);

  if (!code) {
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return noStoreRedirect(loginUrl);
  }

  const supabase = await getSupabaseServerClient();
  if (!supabase) {
    loginUrl.searchParams.set("error", "auth-unavailable");
    return noStoreRedirect(loginUrl);
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    loginUrl.searchParams.set("error", "auth_callback_failed");
    return noStoreRedirect(loginUrl);
  }

  return noStoreRedirect(new URL(nextPath, requestUrl.origin));
}
