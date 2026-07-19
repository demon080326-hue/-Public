import "server-only";

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

let client: SupabaseClient<Database> | undefined;

function readServerRuntimeEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getSupabaseAdminClient() {
  const url = readServerRuntimeEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey =
    readServerRuntimeEnv("SUPABASE_SECRET_KEY") ||
    readServerRuntimeEnv("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    console.error("Supabase admin client unavailable: server environment is incomplete.", {
      hasUrl: Boolean(url),
      hasServerKey: Boolean(serviceRoleKey),
    });
    return null;
  }

  client ??= createClient<Database>(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  });

  return client;
}
