import { getSupabaseServerClient } from "@/lib/supabase/server";
import type { NewsItem } from "@/types/database";

type NewsRow = Partial<NewsItem> & {
  title?: string | null;
  summary?: string | null;
  content?: string | null;
  url?: string | null;
  source?: string | null;
  author?: string | null;
  created_at?: string | null;
  status?: string | null;
  ai_score?: number | null;
};

function normalizeNewsItem(row: NewsRow): NewsItem {
  const title = row.title_zh ?? row.title ?? row.title_original ?? "未命名 AI 情報";
  const sourceUrl = row.source_url ?? row.canonical_url ?? row.url ?? "";

  return {
    id: row.id ?? "",
    fingerprint: row.fingerprint ?? row.id ?? title,
    title_original: row.title_original ?? title,
    title_zh: title,
    summary_short: row.summary_short ?? row.summary ?? null,
    summary_full: row.summary_full ?? row.content ?? row.summary ?? null,
    why_it_matters: row.why_it_matters ?? null,
    source_name: row.source_name ?? row.source ?? row.author ?? "Restart Lab",
    source_url: sourceUrl,
    canonical_url: (row.canonical_url ?? sourceUrl) || null,
    company: row.company ?? "AI",
    category: row.category ?? "AI 情報",
    tags: Array.isArray(row.tags) ? row.tags : [],
    language: row.language ?? "zh-Hant",
    published_at: row.published_at ?? row.created_at ?? null,
    importance_score: row.importance_score ?? row.ai_score ?? 0,
    confidence_score: row.confidence_score ?? 0,
    quality_score: row.quality_score ?? 0,
    is_breaking: row.is_breaking ?? false,
    is_duplicate: row.is_duplicate ?? false,
    is_spam: row.is_spam ?? false,
    is_verified: row.is_verified ?? false,
    is_published: row.is_published ?? row.status === "published",
    review_status: row.review_status ?? "approved",
    image_url: row.image_url ?? null,
  };
}

function interleaveBySource(items: NewsItem[]) {
  const buckets = new Map<string, NewsItem[]>();
  const sourceOrder: string[] = [];

  for (const item of items) {
    const source = item.source_name || "其他";
    if (!buckets.has(source)) {
      buckets.set(source, []);
      sourceOrder.push(source);
    }
    buckets.get(source)?.push(item);
  }

  const arranged: NewsItem[] = [];
  let hasItems = true;

  while (hasItems) {
    hasItems = false;
    for (const source of sourceOrder) {
      const next = buckets.get(source)?.shift();
      if (next) {
        arranged.push(next);
        hasItems = true;
      }
    }
  }

  return arranged;
}

export async function getPublishedNews(limit = 24): Promise<NewsItem[]> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("ai_news")
    .select("*")
    .order("published_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`讀取 AI 情報失敗：${error.message}`);
  return interleaveBySource(((data ?? []) as NewsRow[]).map(normalizeNewsItem));
}

export async function getNewsById(id: string): Promise<NewsItem | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.from("ai_news").select("*").eq("id", id).single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`讀取 AI 情報失敗：${error.message}`);
  }

  return normalizeNewsItem(data as NewsRow);
}
