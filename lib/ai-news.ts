export type AiNewsInput = {
  title: string;
  summary: string;
  content: string;
  category: string;
  author: string;
  url: string;
  imageUrl: string | null;
  publishedAt: string | null;
  tags: string[];
  aiScore: number;
};

type AiNewsPayload = {
  title?: unknown;
  summary?: unknown;
  excerpt?: unknown;
  content?: unknown;
  category?: unknown;
  source?: unknown;
  source_url?: unknown;
  image_url?: unknown;
  published_at?: unknown;
  importance_score?: unknown;
  tags?: unknown;
  is_breaking?: unknown;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function validHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

type ParseOptions = {
  requireSource?: boolean;
};

export function parseAiNewsPayload(payload: AiNewsPayload, options: ParseOptions = {}): { data?: AiNewsInput; error?: string } {
  const title = text(payload.title);
  const summary = text(payload.summary) || text(payload.excerpt);
  const content = text(payload.content);
  const category = text(payload.category) || "AI 平台";
  const submittedSource = text(payload.source);
  const author = submittedSource || "Restart Lab";
  const url = text(payload.source_url);
  const imageUrl = text(payload.image_url);
  const submittedDate = text(payload.published_at);
  const publishedAt = submittedDate || null;
  const importanceScore = payload.importance_score;
  const aiScore = importanceScore === undefined || importanceScore === null || importanceScore === "" ? 0 : Number(importanceScore);

  const tags = payload.tags === undefined || payload.tags === null ? [] : payload.tags;

  if (!title) return { error: "缺少 title。" };
  if (!summary) return { error: "缺少 summary 或 excerpt。" };
  if (!content) return { error: "缺少 content。" };
  if (options.requireSource && !submittedSource) return { error: "缺少 source。" };
  if (!url) return { error: "缺少 source_url。" };

  if (title.length > 200 || summary.length > 1000 || content.length > 20000 || category.length > 100 || author.length > 200) {
    return { error: "輸入內容過長，請縮短後再送出。" };
  }

  if (!validHttpUrl(url)) return { error: "原始來源網址格式不正確，必須以 http:// 或 https:// 開頭。" };
  if (imageUrl && !validHttpUrl(imageUrl)) return { error: "圖片網址格式不正確，必須以 http:// 或 https:// 開頭。" };
  if (publishedAt && Number.isNaN(new Date(publishedAt).getTime())) return { error: "published_at 日期格式不正確。" };
  if (!Number.isInteger(aiScore) || aiScore < 0 || aiScore > 100) return { error: "importance_score 必須是 0 到 100 的整數。" };
  if (!Array.isArray(tags) || tags.some((tag) => typeof tag !== "string")) return { error: "tags 必須是字串陣列。" };

  const normalizedTags = tags.map((tag) => tag.trim()).filter(Boolean).slice(0, 12);

  return {
    data: {
      title,
      summary,
      content,
      category,
      author,
      url,
      imageUrl: imageUrl || null,
      publishedAt,
      tags: normalizedTags,
      aiScore,
    },
  };
}
