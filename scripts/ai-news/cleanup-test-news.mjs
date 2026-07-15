import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

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

function text(value) {
  return String(value ?? "").trim();
}

function getTitle(row) {
  return text(row.title ?? row.title_zh ?? row.title_original);
}

function getSource(row) {
  return text(row.source ?? row.source_name ?? row.author);
}

function getSourceUrl(row) {
  return text(row.source_url ?? row.url ?? row.canonical_url);
}

function isTestNews(row) {
  const title = getTitle(row);
  const source = getSource(row);
  const sourceUrl = getSourceUrl(row);

  return (
    title === "123" ||
    title.toLowerCase().includes("n8n") ||
    source === "123" ||
    source === "n8n Test" ||
    sourceUrl.includes("example.com")
  );
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

  const { data, error } = await supabase.from("ai_news").select("*").limit(1000);
  if (error) throw new Error(`讀取 ai_news 失敗：${error.message}`);

  const targets = (data ?? []).filter(isTestNews);
  console.log(`找到測試資料 ${targets.length} 筆。`);

  if (!targets.length) {
    console.log("沒有需要清除的測試資料");
    return;
  }

  for (const row of targets) {
    console.log(`delete candidate: id=${row.id} title="${getTitle(row)}" source="${getSource(row)}" source_url="${getSourceUrl(row)}"`);
  }

  const ids = targets.map((row) => row.id).filter(Boolean);
  const { error: deleteError } = await supabase.from("ai_news").delete().in("id", ids);
  if (deleteError) throw new Error(`刪除測試資料失敗：${deleteError.message}`);

  console.log(`deleted ${ids.length} 筆。`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
