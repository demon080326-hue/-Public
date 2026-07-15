# AI 情報自動收集系統

這套系統不用 n8n、Zapier 或 Make，也不需要付月費。它使用 GitHub Actions + Node.js 腳本自動收集 AI 情報，寫入 Supabase `public.ai_news`，前台 `/news` 會自動讀取最新資料。

## 目前來源

第三階段已改成多來源收集。來源由這個檔案管理：

```text
scripts/ai-news/sources.mjs
```

目前啟用來源：

- Hugging Face Blog RSS
- OpenAI News RSS
- Google DeepMind Blog RSS

Anthropic 暫時保留在 `sources.mjs`，但因常見 RSS URL 目前回傳 404，先設為 `enabled: false`，避免排程每次出現失敗來源。

腳本會逐一讀取 `enabled: true` 的來源，整理成 AI 情報格式，寫入 Supabase。寫入前會用既有資料表中的 `source_url`、`url` 或 `canonical_url` 欄位去重；如果已存在，就顯示 `skipped`，不重複新增。

如果某個來源 403、404、timeout 或 RSS 格式錯誤，流程會記錄為 failed source，然後繼續跑下一個來源，不會中斷整個收集流程。

## 規則式摘要與分類

目前不使用 OpenAI、Claude、Gemini 或任何付費 AI API。摘要、分類與重要性判斷都使用免費規則式邏輯。

摘要格式：

```text
{source} 發布：{title}。這篇內容與 {category} 相關，適合關注 AI 產品、技術趨勢與工具更新的人閱讀。
```

分類規則：

- OpenAI、Anthropic：`AI 平台`
- Hugging Face：`AI 工具`
- Google DeepMind：`研究論文`
- 標題或摘要包含 `model`、`llm`、`inference`、`transformer`、`benchmark`：`技術趨勢`
- 包含 `release`、`launch`、`announce`、`update`：`產品發布`
- 包含 `agent`、`agents`、`tool`、`tools`：`AI 工具`
- 預設：`AI 情報`

重要性規則：

- 預設 `importance_score = 50`
- 包含 `model`、`llm`、`agent`、`agents`、`inference`、`transformer`、`release`、`launch`、`benchmark`：`70`
- OpenAI、Anthropic、Google DeepMind 最低 `70`
- 包含 `safety`、`security`、`major`、`breakthrough`、`frontier`：`85`
- `importance_score >= 85` 或標題包含重大關鍵字時，`is_breaking = true`

## 新增或停用來源

新增來源時，在 `scripts/ai-news/sources.mjs` 加一筆：

```js
{
  id: "new-source-id",
  name: "Source Name",
  type: "rss",
  url: "https://example.com/feed.xml",
  category: "AI 情報",
  enabled: true
}
```

停用來源：

```js
enabled: false
```

## GitHub Actions

Workflow 檔案：

```text
.github/workflows/ai-news-collector.yml
```

排程：

```yaml
cron: "0 1 */3 * *"
```

這代表每 3 天 UTC 01:00 執行一次，約為台灣時間早上 09:00。

## GitHub Secrets

請在 GitHub repository 設定以下 Secrets：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

本機若已經有 `NEXT_PUBLIC_SUPABASE_URL`，腳本也會把它當作 `SUPABASE_URL` 的 fallback。

不要把 `SUPABASE_SERVICE_ROLE_KEY` 寫進程式碼、README 或公開文件。

## 本機測試

請在 `next-app` 目錄執行：

```bash
npm run ai-news:collect
```

本機測試需要 `.env.local` 裡有：

```text
NEXT_PUBLIC_SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

或使用：

```text
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

如果缺少環境變數，腳本會顯示清楚錯誤，例如：

```text
缺少 SUPABASE_URL 或 NEXT_PUBLIC_SUPABASE_URL
缺少 SUPABASE_SERVICE_ROLE_KEY
```

## 手動執行 GitHub Actions

1. 打開 GitHub repository。
2. 進入 `Actions`。
3. 選擇 `AI News Collector`。
4. 點 `Run workflow`。
5. 等 workflow 跑完。
6. 檢查 log 是否出現 `inserted` 或 `skipped`。

## 如何確認成功

成功時可以用三個地方確認：

1. GitHub Actions log 顯示 `inserted`。
2. Supabase `public.ai_news` 有新資料。
3. 網站 `/news` 前台出現新的 Hugging Face AI 情報。

如果 log 顯示 `skipped`，代表該 `source_url` 已存在，系統正確跳過重複資料。

## 下一階段來源

下一階段可以逐步加入：

- OpenAI Blog
- Anthropic News
- Google DeepMind Blog
- Microsoft AI Blog
- Meta AI Blog
- arXiv
- GitHub Trending AI
- Product Hunt AI
