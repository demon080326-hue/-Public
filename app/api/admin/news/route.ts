import { NextResponse } from "next/server";
import { parseAiNewsPayload } from "@/lib/ai-news";
import { requireAdminAccess } from "@/lib/admin-access";
import { writeAdminAuditLog } from "@/lib/admin-audit-log";
import { getSupabaseAdminClient } from "@/lib/supabase-admin";

export const runtime = "nodejs";

type ApiError = {
  ok: false;
  message: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

function errorResponse(status: number, error: Omit<ApiError, "ok">) {
  return NextResponse.json({ ok: false, ...error } satisfies ApiError, { status });
}

function adminAccessCode(status: string) {
  if (status === "profile_missing") return "PROFILE_MISSING";
  if (status === "email_unverified") return "EMAIL_UNVERIFIED";
  if (status === "reverification_required") return "REVERIFICATION_REQUIRED";
  return "ADMIN_REQUIRED";
}

function adminAccessMessage(status: string) {
  if (status === "profile_missing") return "找不到會員 Profile，請先回會員中心同步帳號狀態。";
  if (status === "email_unverified") return "請先完成 Email 驗證後再使用管理功能。";
  if (status === "reverification_required") return "請先完成 Email 6 位數重新驗證。";
  return "此功能僅限 admin / owner 使用。";
}

export async function POST(request: Request) {
  const access = await requireAdminAccess();
  if (access.status === "unauthenticated") {
    return errorResponse(401, { message: "請先登入管理員帳號。", code: "AUTH_REQUIRED" });
  }
  if (access.status !== "allowed") {
    return errorResponse(403, {
      message: adminAccessMessage(access.status),
      code: adminAccessCode(access.status),
    });
  }

  if (!access.user || !access.role) {
    return errorResponse(500, { message: "Admin identity is unavailable.", code: "ADMIN_IDENTITY_MISSING" });
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, { message: "送出的資料不是有效 JSON，請重新整理後再試。", code: "INVALID_JSON" });
  }

  const parsed = parseAiNewsPayload(body);
  if (!parsed.data) {
    return errorResponse(400, { message: parsed.error ?? "資料格式不符合 AI 情報欄位要求。", code: "VALIDATION_ERROR" });
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return errorResponse(500, { message: "缺少 NEXT_PUBLIC_SUPABASE_URL。", code: "ENV_MISSING" });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse(500, { message: "缺少 SUPABASE_SERVICE_ROLE_KEY。", code: "ENV_MISSING" });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return errorResponse(500, { message: "無法建立 Supabase server client。", code: "SUPABASE_CLIENT_ERROR" });
  }

  try {
    const { data, error } = await supabase
      .from("ai_news")
      .insert({
        title: parsed.data.title,
        summary: parsed.data.summary,
        content: parsed.data.content,
        category: parsed.data.category,
        author: parsed.data.author,
        url: parsed.data.url,
        image_url: parsed.data.imageUrl,
        published_at: parsed.data.publishedAt ?? new Date().toISOString(),
        language: "zh-Hant",
        tags: parsed.data.tags,
        ai_score: parsed.data.aiScore,
      })
      .select("id,title,category,url,published_at,created_at")
      .single();

    if (error) {
      console.error("Create AI news failed:", error);
      return errorResponse(500, {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }

    await writeAdminAuditLog({
      actor: {
        userId: access.user.id,
        email: access.user.email,
        role: access.role,
      },
      action: "admin_news_create",
      resourceType: "ai_news",
      resourceId: data.id,
      afterData: {
        title: data.title,
        category: data.category,
        url: data.url,
        published_at: data.published_at,
        created_at: data.created_at,
      },
      request,
    });

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (error) {
    console.error("Create AI news failed:", error);
    return errorResponse(500, {
      message: error instanceof Error ? error.message : "新增 AI 情報時發生未知錯誤。",
      code: "UNEXPECTED_ERROR",
    });
  }
}
