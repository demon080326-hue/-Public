import { NextResponse } from "next/server";
import { parseAiNewsPayload } from "@/lib/ai-news";
import { getCurrentMemberContext, hasAdminAccess, isSecurityAccessBlocked } from "@/lib/member-profile";
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

export async function POST(request: Request) {
  const member = await getCurrentMemberContext();
  if (!member) {
    return errorResponse(401, { message: "請先登入管理員帳號。", code: "AUTH_REQUIRED" });
  }
  if (isSecurityAccessBlocked(member)) {
    return errorResponse(403, { message: "請先完成 Email 重新驗證。", code: "REVERIFICATION_REQUIRED" });
  }
  if (!hasAdminAccess(member.profile?.role)) {
    return errorResponse(403, { message: "此功能僅限管理員使用。", code: "ADMIN_REQUIRED" });
  }

  let body: Record<string, unknown>;

  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, { message: "送出資料格式錯誤，請重新填寫表單。", code: "INVALID_JSON" });
  }

  if (process.env.NODE_ENV === "production") {
    return errorResponse(403, { message: "此本機 CMS 尚未啟用正式登入驗證，正式環境禁止直接新增。", code: "CMS_LOCAL_ONLY" });
  }

  const parsed = parseAiNewsPayload(body);
  if (!parsed.data) return errorResponse(400, { message: parsed.error ?? "資料表欄位不符合。", code: "VALIDATION_ERROR" });

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
      .select("id")
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

    return NextResponse.json({ ok: true, id: data.id }, { status: 201 });
  } catch (error) {
    console.error("Create AI news failed:", error);
    return errorResponse(500, {
      message: error instanceof Error ? error.message : "新增 AI 情報時發生未預期錯誤。",
      code: "UNEXPECTED_ERROR",
    });
  }
}
