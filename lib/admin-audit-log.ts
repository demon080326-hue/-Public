import "server-only";

import { createHash } from "node:crypto";
import { requireAdminAccess } from "@/lib/admin-access";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import type {
  AdminAuditAction,
  AdminAuditLogRow,
  AdminAuditResourceType,
  Json,
  MemberRole,
} from "@/types/database";

const MAX_DEPTH = 6;
const MAX_ARRAY_ITEMS = 50;
const MAX_OBJECT_KEYS = 50;
const MAX_STRING_LENGTH = 2_000;
const MAX_JSON_LENGTH = 16_000;

const SENSITIVE_KEY_PARTS = [
  "password",
  "token",
  "access_token",
  "refresh_token",
  "api_key",
  "secret",
  "service_role",
  "authorization",
  "cookie",
  "resend",
  "smtp",
  "supabase_secret",
];

export type AdminAuditActor = {
  userId: string;
  email: string | null;
  role: MemberRole;
};

export type WriteAdminAuditLogInput = {
  actor: AdminAuditActor;
  action: AdminAuditAction;
  resourceType: AdminAuditResourceType;
  resourceId?: string | null;
  targetUserId?: string | null;
  targetEmail?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  reason?: string | null;
  metadata?: unknown;
  request?: Request | null;
};

export type AdminAuditLogSummary = Pick<
  AdminAuditLogRow,
  "id" | "actor_email" | "actor_role" | "action" | "resource_type" | "resource_id" | "reason" | "created_at"
>;

function isSensitiveKey(key: string) {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, "");
  return SENSITIVE_KEY_PARTS.some((part) => normalized.includes(part.replace(/[^a-z0-9]/g, "")));
}

function sanitizeValue(value: unknown, depth: number): Json | undefined {
  if (depth > MAX_DEPTH) return "[truncated]";
  if (value === null) return null;
  if (typeof value === "string") return value.slice(0, MAX_STRING_LENGTH);
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "boolean") return value;
  if (value instanceof Date) return value.toISOString();

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, depth + 1))
      .filter((item): item is Json => item !== undefined);
  }

  if (typeof value === "object") {
    const output: Record<string, Json> = {};
    const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OBJECT_KEYS);

    for (const [key, item] of entries) {
      if (isSensitiveKey(key)) continue;
      const sanitized = sanitizeValue(item, depth + 1);
      if (sanitized !== undefined) output[key.slice(0, 100)] = sanitized;
    }

    return output;
  }

  return undefined;
}

export function sanitizeAuditMetadata(value: unknown): Json | null {
  const sanitized = sanitizeValue(value, 0);
  if (sanitized === undefined) return null;

  try {
    if (JSON.stringify(sanitized).length > MAX_JSON_LENGTH) {
      return { truncated: true };
    }
  } catch {
    return null;
  }

  return sanitized;
}

export function hashIpIfAvailable(request?: Request | null) {
  if (!request) return null;

  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip")?.trim();
  if (!ip) return null;

  return createHash("sha256").update(`admin-audit:${ip}`).digest("hex");
}

function normalizeText(value: string | null | undefined, maxLength: number) {
  const normalized = value?.trim();
  return normalized ? normalized.slice(0, maxLength) : null;
}

export async function writeAdminAuditLog(input: WriteAdminAuditLogInput) {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    console.error("Admin audit log write skipped: server client unavailable.");
    return false;
  }

  const { error } = await supabase.from("admin_audit_logs").insert({
    actor_user_id: input.actor.userId,
    actor_email: normalizeText(input.actor.email?.toLowerCase(), 320),
    actor_role: input.actor.role,
    target_user_id: input.targetUserId ?? null,
    target_email: normalizeText(input.targetEmail?.toLowerCase(), 320),
    action: input.action,
    resource_type: input.resourceType,
    resource_id: normalizeText(input.resourceId, 500),
    before_data: sanitizeAuditMetadata(input.beforeData),
    after_data: sanitizeAuditMetadata(input.afterData),
    reason: normalizeText(input.reason, 1_000),
    ip_hash: hashIpIfAvailable(input.request),
    user_agent: normalizeText(input.request?.headers.get("user-agent"), 1_000),
    metadata: sanitizeAuditMetadata(input.metadata),
  });

  if (error) {
    console.error("Admin audit log write failed:", { code: error.code, message: error.message });
    return false;
  }

  return true;
}

export async function getAdminAuditLogs(limit = 5): Promise<AdminAuditLogSummary[]> {
  const access = await requireAdminAccess();
  if (access.status !== "allowed") return [];

  const supabase = getSupabaseAdminClient();
  if (!supabase) return [];

  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 25);
  const { data, error } = await supabase
    .from("admin_audit_logs")
    .select("id,actor_email,actor_role,action,resource_type,resource_id,reason,created_at")
    .order("created_at", { ascending: false })
    .limit(safeLimit);

  if (error) {
    console.error("Admin audit log read failed:", { code: error.code, message: error.message });
    return [];
  }

  return data;
}
