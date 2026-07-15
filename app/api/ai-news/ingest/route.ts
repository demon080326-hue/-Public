import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { parseAiNewsPayload } from "@/lib/ai-news";
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

function hasValidBearerToken(request: Request, secret: string) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = Buffer.from(secret);
  const actual = Buffer.from(token);

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function POST(request: Request) {
  const ingestSecret = process.env.AI_NEWS_INGEST_SECRET;
  if (!ingestSecret) {
    return errorResponse(503, { message: "缺少 AI_NEWS_INGEST_SECRET", code: "ENV_MISSING" });
  }

  if (!hasValidBearerToken(request, ingestSecret)) {
    return errorResponse(401, { message: "未授權", code: "UNAUTHORIZED" });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return errorResponse(400, { message: "API 錯誤：JSON 格式不正確。", code: "INVALID_JSON" });
  }

  const parsed = parseAiNewsPayload(body, { requireSource: true });
  if (!parsed.data) return errorResponse(400, { message: parsed.error ?? "資料表欄位不符合。", code: "VALIDATION_ERROR" });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return errorResponse(500, { message: "缺少 NEXT_PUBLIC_SUPABASE_URL", code: "ENV_MISSING" });
  }

  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return errorResponse(500, { message: "缺少 SUPABASE_SERVICE_ROLE_KEY", code: "ENV_MISSING" });
  }

  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    return errorResponse(500, { message: "無法建立 Supabase server client。", code: "SUPABASE_CLIENT_ERROR" });
  }

  try {
    const { data: existing, error: duplicateCheckError } = await supabase
      .from("ai_news")
      .select("id")
      .eq("url", parsed.data.url)
      .maybeSingle();

    if (duplicateCheckError) {
      console.error("AI news duplicate check failed:", duplicateCheckError);
      return errorResponse(500, {
        message: duplicateCheckError.message,
        details: duplicateCheckError.details,
        hint: duplicateCheckError.hint,
        code: duplicateCheckError.code,
      });
    }

    if (existing) {
      return NextResponse.json({
        ok: true,
        duplicated: true,
        message: "這篇 AI 情報已存在",
        id: existing.id,
      });
    }

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
      console.error("AI news ingest failed:", error);
      return errorResponse(500, {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code,
      });
    }

    return NextResponse.json({ ok: true, duplicated: false, id: data.id, url: `/news/${data.id}` }, { status: 201 });
  } catch (error) {
    console.error("AI news ingest failed:", error);
    return errorResponse(500, {
      message: error instanceof Error ? error.message : "AI 情報接收時發生未預期錯誤。",
      code: "UNEXPECTED_ERROR",
    });
  }
}
