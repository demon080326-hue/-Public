import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";
import { aiNewsSources } from "./sources.mjs";

const MAX_ITEMS_PER_SOURCE = Number(process.env.AI_NEWS_MAX_ITEMS ?? 5);
const REQUEST_TIMEOUT_MS = Number(process.env.AI_NEWS_REQUEST_TIMEOUT_MS ?? 20000);
const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);

function loadLocalEnv() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;

    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;

      const [name, ...rest] = trimmed.split("=");
      if (process.env[name]) continue;
      process.env[name] = rest.join("=").trim().replace(/^["']|["']$/g, "");
    }
  }
}

function requireSupabaseUrl() {
  const value = process.env.SUPABASE_URL?.trim() || process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  if (!value) throw new Error("缺少 SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_URL");
  return value;
}

function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`缺少 ${name}`);
  return value;
}

function decodeEntities(value) {
  return String(value ?? "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'");
}

function text(value) {
  return decodeEntities(value)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tag(block, name) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i"));
  return match ? match[1] : "";
}

function normalizeUrl(value) {
  const raw = text(value);
  if (!raw) return "";

  try {
    const url = new URL(raw);
    for (const key of [...url.searchParams.keys()]) {
      if (key.startsWith("utm_") || ["ref", "fbclid", "gclid"].includes(key)) {
        url.searchParams.delete(key);
      }
    }
    url.hash = "";
    return url.toString().replace(/\/$/, "");
  } catch {
    return raw;
  }
}

function toIsoDate(value) {
  const raw = text(value);
  const date = raw ? new Date(raw) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function firstExisting(columns, names) {
  return names.find((name) => columns.has(name));
}

function hasAny(value, keywords) {
  const haystack = value.toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

function classifyNews(title, description, sourceName) {
  const source = sourceName.toLowerCase();
  const body = `${title} ${description}`.toLowerCase();

  if (source === "openai" || source === "anthropic") return "AI 平台";
  if (source === "hugging face") return "AI 工具";
  if (source === "google deepmind") return "研究論文";
  if (source === "brief ai") return "AI 電子報";
  if (source === "aibase ai 日報") return "AI 日報";

  if (hasAny(body, ["model", "llm", "inference", "transformer", "benchmark"])) return "技術趨勢";
  if (hasAny(body, ["release", "launch", "announce", "update"])) return "產品發布";
  if (hasAny(body, ["agent", "agents", "tool", "tools"])) return "AI 工具";

  return "AI 情報";
}

function getImportanceScore(title, description, sourceName) {
  const source = sourceName.toLowerCase();
  const body = `${title} ${description}`.toLowerCase();
  let score = 50;

  if (hasAny(body, ["model", "llm", "agent", "agents", "inference", "transformer", "release", "launch", "benchmark"])) {
    score = 70;
  }

  if (["openai", "anthropic", "google deepmind"].includes(source)) {
    score = Math.max(score, 70);
  }

  if (hasAny(body, ["safety", "security", "major", "breakthrough", "frontier"])) {
    score = 85;
  }

  return score;
}

function isBreakingNews(title, importanceScore) {
  return importanceScore >= 85 || hasAny(title, ["major", "breakthrough", "launch", "release", "frontier", "safety"]);
}

function buildSummary({ source, title, category }) {
  return `${source} 發布：${title}。這篇內容與 ${category} 相關，適合關注 AI 產品、技術趨勢與工具更新的人閱讀。`;
}

function buildContent({ source, title, category, sourceUrl }) {
  return [
    `標題：${title}`,
    "",
    `來源：${source}`,
    "",
    `分類：${category}`,
    "",
    "重點整理：",
    `這是 ${source} 最新發布的 AI 相關內容。主題可能包含 AI 平台更新、模型能力、開源工具、研究進展、產品發布或技術趨勢。`,
    "",
    "為什麼值得關注：",
    "這類資訊可以協助讀者掌握 AI 產業最新變化，並判斷是否影響自己的工具選擇、內容創作、工作流程或產品規劃。",
    "",
    "原始來源：",
    sourceUrl,
  ].join("\n");
}

function extractItemLink(block, isAtom) {
  if (isAtom) {
    const atomLinkMatch = block.match(/<link[^>]+href=["']([^"']+)["'][^>]*>/i);
    return atomLinkMatch?.[1] ?? text(tag(block, "link"));
  }

  return text(tag(block, "link"));
}

async function fetchRss(source) {
  console.log(`RSS 抓取開始：${source.name} ${source.url}`);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(source.url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Restart-Lab-AI-News-Collector/1.0",
        Accept: "application/rss+xml, application/xml, text/xml",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const xml = await response.text();
    if (!xml.trim()) throw new Error("RSS 回應內容為空");
    return xml;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeImageUrl(value, baseUrl) {
  const raw = decodeEntities(String(value ?? "").trim());
  if (!raw || raw.startsWith("data:")) return "";

  try {
    const url = new URL(raw, baseUrl);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : "";
  } catch {
    return "";
  }
}

function sourceItemLimit(source) {
  const configured = Number(source.maxItems ?? MAX_ITEMS_PER_SOURCE);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : MAX_ITEMS_PER_SOURCE;
}

function sleep(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function fetchHtml(source) {
  console.log(`HTML 抓取開始：${source.name} ${source.url}`);

  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const response = await fetch(source.url, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "zh-TW,zh;q=0.9,en;q=0.8",
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status} ${response.statusText}`);
        if (!RETRYABLE_STATUS_CODES.has(response.status) || attempt === 3) throw error;
        lastError = error;
      } else {
        const html = await response.text();
        if (!html.trim()) throw new Error("HTML 回應內容為空");
        return html;
      }
    } catch (error) {
      lastError = error;
      if (attempt === 3) throw error;
    } finally {
      clearTimeout(timeout);
    }

    console.warn(`${source.name} 抓取第 ${attempt} 次失敗，準備重試。`);
    await sleep(700 * attempt);
  }

  throw lastError ?? new Error("HTML 抓取失敗");
}

function buildNewsItem({ source, title, description, sourceUrl, publishedAt, imageUrl = "" }) {
  const category = classifyNews(title, description || source.category, source.name);
  const importanceScore = getImportanceScore(title, description, source.name);

  return {
    title,
    summary: buildSummary({ source: source.name, title, category }),
    content: buildContent({ source: source.name, title, category, sourceUrl }),
    category,
    source: source.name,
    source_url: sourceUrl,
    image_url: normalizeImageUrl(imageUrl, sourceUrl),
    published_at: publishedAt,
    status: "published",
    importance_score: importanceScore,
    is_breaking: isBreakingNews(title, importanceScore),
    tags: [source.name, "AI 情報", category],
  };
}

function parseBriefAi(html, source) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const items = [];

  $('a[href*="/p/"]').each((_, element) => {
    if (items.length >= sourceItemLimit(source)) return false;

    const href = $(element).attr("href");
    if (!href) return;
    const sourceUrl = normalizeUrl(new URL(href, source.url).toString());
    if (!new URL(sourceUrl).pathname.startsWith("/p/") || seen.has(sourceUrl)) return;

    const rawTitle = text($(element).text());
    if (!rawTitle || /subscribe|advertis|合作|訂閱/i.test(rawTitle)) return;
    seen.add(sourceUrl);

    const dateMatch = rawTitle.match(/^(\d{4}-\d{2}-\d{2})\s*/);
    const title = rawTitle.replace(/^\d{4}-\d{2}-\d{2}\s*/, "").trim();
    const imageUrl = $(element).find("img").first().attr("src") || $(element).find("img").first().attr("data-src");
    items.push(buildNewsItem({
      source,
      title,
      description: source.category,
      sourceUrl,
      publishedAt: toIsoDate(dateMatch?.[1]),
      imageUrl,
    }));
  });

  return items;
}

function parseAiBaseDaily(html, source) {
  const $ = cheerio.load(html);
  const seen = new Set();
  const items = [];

  $('a[href*="/tw/daily/"]').each((_, element) => {
    if (items.length >= sourceItemLimit(source)) return false;

    const href = $(element).attr("href");
    if (!href) return;
    const resolvedUrl = new URL(href, source.url);
    if (!/^\/tw\/daily\/\d+\/?$/.test(resolvedUrl.pathname)) return;

    const sourceUrl = normalizeUrl(resolvedUrl.toString());
    if (seen.has(sourceUrl)) return;

    const title = text($(element).find("img[alt]").first().attr("alt") || $(element).find(".font600").first().text());
    if (!title) return;
    seen.add(sourceUrl);

    const description = text($(element).find(".truncate2").first().text()) || source.category;
    const imageUrl = $(element).find("img").first().attr("src") || $(element).find("img").first().attr("data-src");
    items.push(buildNewsItem({
      source,
      title,
      description,
      sourceUrl,
      publishedAt: new Date().toISOString(),
      imageUrl,
    }));
  });

  return items;
}

function parseHtml(html, source) {
  if (source.parser === "brief-ai-archive") return parseBriefAi(html, source);
  if (source.parser === "aibase-daily") return parseAiBaseDaily(html, source);
  throw new Error(`未支援的 HTML parser：${source.parser ?? "未設定"}`);
}

function parseRss(xml, source) {
  const itemBlocks = xml.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const entryBlocks = xml.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  const blocks = itemBlocks.length ? itemBlocks : entryBlocks;

  if (!blocks.length) {
    throw new Error("RSS 格式錯誤：找不到 item 或 entry");
  }

  return blocks.slice(0, sourceItemLimit(source)).map((block) => {
    const isAtom = /^<entry/i.test(block.trim());
    const title = text(tag(block, "title"));
    const description = text(tag(block, "description") || tag(block, "summary") || tag(block, "content"));
    const sourceUrl = normalizeUrl(extractItemLink(block, isAtom));
    const publishedAt = toIsoDate(tag(block, "pubDate") || tag(block, "published") || tag(block, "updated"));
    const mediaMatch = block.match(/<media:(?:content|thumbnail)\b[^>]*\burl=["']([^"']+)["']/i);
    const enclosureMatch = block.match(/<enclosure\b(?=[^>]*\btype=["']image\/)[^>]*\burl=["']([^"']+)["']/i);
    const inlineImageMatch = block.match(/<img\b[^>]*\bsrc=["']([^"']+)["']/i);
    const imageUrl = mediaMatch?.[1] ?? enclosureMatch?.[1] ?? inlineImageMatch?.[1] ?? "";
    return buildNewsItem({ source, title, description, sourceUrl, publishedAt, imageUrl });
  }).filter((item) => item.title && item.source_url);
}

async function getTableColumns(supabase, supabaseUrl, serviceRoleKey) {
  const openApiUrl = `${supabaseUrl.replace(/\/$/, "")}/rest/v1/`;

  try {
    const response = await fetch(openApiUrl, {
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
      },
    });

    if (response.ok) {
      const schema = await response.json();
      const properties =
        schema?.definitions?.ai_news?.properties ??
        schema?.components?.schemas?.ai_news?.properties ??
        schema?.definitions?.public_ai_news?.properties ??
        schema?.components?.schemas?.public_ai_news?.properties;

      if (properties && typeof properties === "object") {
        return new Set(Object.keys(properties));
      }
    }
  } catch {
    // Fall back to reading one row below.
  }

  const { data, error } = await supabase.from("ai_news").select("*").limit(1);
  if (error) throw new Error(`檢查 public.ai_news 欄位失敗：${error.message}`);
  if (data?.[0]) return new Set(Object.keys(data[0]));

  throw new Error("檢查 public.ai_news 欄位失敗：資料表沒有資料，且無法讀取 REST schema。");
}

function buildInsertPayload(item, columns) {
  const payload = {};
  const setIfExists = (column, value) => {
    if (column && columns.has(column)) payload[column] = value;
  };

  setIfExists(firstExisting(columns, ["title", "title_zh", "title_original"]), item.title);
  setIfExists(firstExisting(columns, ["summary", "excerpt", "summary_short"]), item.summary);
  setIfExists(firstExisting(columns, ["content", "summary_full"]), item.content);
  setIfExists("category", item.category);
  setIfExists(firstExisting(columns, ["source", "source_name", "author"]), item.source);
  setIfExists(firstExisting(columns, ["source_url", "url", "canonical_url"]), item.source_url);
  setIfExists("published_at", item.published_at);
  setIfExists("status", item.status);
  setIfExists(firstExisting(columns, ["importance_score", "ai_score"]), item.importance_score);
  setIfExists("is_breaking", item.is_breaking);
  setIfExists("tags", item.tags);
  setIfExists("language", "zh-Hant");
  setIfExists("image_url", item.image_url || null);

  return payload;
}

async function findExistingByUrl(supabase, sourceUrl, columns) {
  const urlColumn = firstExisting(columns, ["source_url", "url", "canonical_url"]);
  if (!urlColumn) throw new Error("Supabase 去重查詢失敗：找不到 source_url、url 或 canonical_url 欄位");

  const selectColumns = columns.has("image_url") ? "id,image_url" : "id";
  const { data, error } = await supabase.from("ai_news").select(selectColumns).eq(urlColumn, sourceUrl).maybeSingle();
  if (error) throw new Error(`Supabase 去重查詢失敗：${error.message}`);

  return data ? { id: data.id, column: urlColumn } : null;
}

function isDuplicateError(error) {
  return error?.code === "23505" || /duplicate key|already exists/i.test(error?.message ?? "");
}

async function insertNews(supabase, item, columns) {
  const payload = buildInsertPayload(item, columns);
  const { data, error } = await supabase.from("ai_news").insert(payload).select("id").single();

  if (!error) return { id: data.id };
  if (isDuplicateError(error)) return { skipped: true, reason: error.message };
  throw error;
}

function logSupabaseError(prefix, error) {
  console.error(prefix);
  console.error(`message: ${error.message ?? error}`);
  if (error.details) console.error(`details: ${error.details}`);
  if (error.hint) console.error(`hint: ${error.hint}`);
  if (error.code) console.error(`code: ${error.code}`);
}

async function collectSource({ source, supabase, columns }) {
  const result = {
    source: source.name,
    fetchedItems: 0,
    inserted: 0,
    skipped: 0,
    updatedImages: 0,
    failedItems: 0,
  };

  try {
    const sourceBody = source.type === "rss" ? await fetchRss(source) : await fetchHtml(source);
    const items = source.type === "rss" ? parseRss(sourceBody, source) : parseHtml(sourceBody, source);
    result.fetchedItems = items.length;
    console.log(`${source.name} 抓到 ${items.length} 筆可處理資料。`);

    for (const item of items) {
      try {
        const existing = await findExistingByUrl(supabase, item.source_url, columns);
        if (existing) {
          if (columns.has("image_url") && item.image_url && !existing.image_url) {
            const { error: updateError } = await supabase
              .from("ai_news")
              .update({ image_url: item.image_url })
              .eq("id", existing.id);
            if (updateError) throw updateError;
            result.updatedImages += 1;
            console.log(`updated image: ${item.title} (id=${existing.id})`);
          }
          result.skipped += 1;
          console.log(`skipped: ${item.title} (${existing.column} already exists, id=${existing.id})`);
          continue;
        }

        const inserted = await insertNews(supabase, item, columns);
        if (inserted.skipped) {
          result.skipped += 1;
          console.log(`skipped: ${item.title} (${inserted.reason})`);
          continue;
        }

        result.inserted += 1;
        console.log(`inserted: ${item.title} (id=${inserted.id})`);
      } catch (error) {
        result.failedItems += 1;
        logSupabaseError(`failed item: ${source.name} - ${item.title}`, error);
      }
    }

    return result;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`failed source: ${source.name} (${source.id}) - ${message}`);
    return { ...result, failedSource: true, error: message };
  }
}

async function main() {
  loadLocalEnv();

  const supabaseUrl = requireSupabaseUrl();
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const columns = await getTableColumns(supabase, supabaseUrl, serviceRoleKey);
  console.log(`已檢查 public.ai_news 欄位：${[...columns].sort().join(", ")}`);

  const enabledSources = aiNewsSources.filter((source) => source.enabled);
  const summary = {
    sourcesChecked: 0,
    fetchedItems: 0,
    inserted: 0,
    skipped: 0,
    updatedImages: 0,
    failedSources: [],
    failedItems: 0,
  };

  for (const source of enabledSources) {
    summary.sourcesChecked += 1;
    const result = await collectSource({ source, supabase, columns });

    summary.fetchedItems += result.fetchedItems;
    summary.inserted += result.inserted;
    summary.skipped += result.skipped;
    summary.updatedImages += result.updatedImages;
    summary.failedItems += result.failedItems;

    if (result.failedSource) {
      summary.failedSources.push({ id: source.id, name: source.name, error: result.error });
    }
  }

  console.log("AI 情報收集總結：");
  console.log(`sources checked: ${summary.sourcesChecked}`);
  console.log(`fetched items: ${summary.fetchedItems}`);
  console.log(`inserted: ${summary.inserted}`);
  console.log(`skipped: ${summary.skipped}`);
  console.log(`updated images: ${summary.updatedImages}`);
  console.log(`failed sources: ${summary.failedSources.length}`);
  if (summary.failedSources.length) {
    console.log(JSON.stringify(summary.failedSources, null, 2));
  }
  console.log(JSON.stringify(summary, null, 2));

  if (summary.failedItems > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
