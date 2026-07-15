# 重啟實驗室 AI 情報中心 n8n 工作流

本文件只規劃與測試 AI 情報自動收集，不修改網站頁面。第一階段先完成本機 n8n 測試：確認 n8n 可以呼叫 `POST /api/ai-news/ingest` 並寫入 Supabase。

## 先跑本機 Smoke Test

匯入工作流：

`docs/ai-news-n8n-local-test.workflow.json`

匯入後先修改節點：

1. `Set Local Config`
2. 將 `aiNewsIngestSecret` 改成 `.env.local` 裡的 `AI_NEWS_INGEST_SECRET`
3. 如果 n8n 跑在 Docker，將 `ingestApiUrl` 改成：
   `http://host.docker.internal:3000/api/ai-news/ingest`

測試順序：

1. 確認網站本機伺服器已啟動。
2. 確認 `.env.local` 有 `AI_NEWS_INGEST_SECRET`。
3. n8n 開啟匯入的 workflow。
4. 點 `Execute Workflow`。
5. `Verify Ingest Result` 應回 `ok: true`。
6. 打開 `/news`，確認看到 `n8n 本機測試 AI 情報`。
7. 打開回傳的 `/news/{id}`，確認詳細頁正常。

## 正式工作流總覽

建議拆成兩條 workflow：

1. `AI News Collector - Every 3 Days`
2. `AI News Breaking Watch - Daily`

第一條負責穩定彙整，第二條只放行重大新聞。

## 節點清單與設定

### 1. Manual Trigger

用途：本機測試。正式上線前保留，但不要只依賴它。

設定：無。

### 2. Schedule Trigger - Every 3 Days

用途：每 3 天收集一次一般 AI 情報。

設定：

- Mode: Every X
- Value: 3
- Unit: Days
- 建議時間：上午 09:00

本機測試時先停用。

### 3. Schedule Trigger - Breaking Watch

用途：每天檢查一次重大 AI 消息。若要更即時，可改成每 6 小時。

設定：

- Mode: Every Day 或 Every X Hours
- Breaking workflow 的門檻要比一般流程更高。

本機測試時先停用。

### 4. Set Config

用途：集中管理測試模式、來源數量、分數門檻與 API URL。

欄位：

```json
{
  "dry_run": true,
  "max_items_per_source": 5,
  "regular_cutoff_days": 7,
  "breaking_cutoff_hours": 24,
  "min_importance_score": 55,
  "breaking_min_score": 85,
  "ingest_api_url": "http://localhost:3000/api/ai-news/ingest"
}
```

如果 n8n 在 Docker：

```text
http://host.docker.internal:3000/api/ai-news/ingest
```

### 5. Build Source List

用途：產生要抓取的來源清單。

建議用 `Code` node，輸出每個來源一筆 item：

```js
return [
  {
    json: {
      source: "OpenAI",
      source_type: "html",
      url: "https://openai.com/news/",
      category_hint: "AI 平台"
    }
  },
  {
    json: {
      source: "Anthropic",
      source_type: "html",
      url: "https://www.anthropic.com/news",
      category_hint: "AI 平台"
    }
  },
  {
    json: {
      source: "Google DeepMind",
      source_type: "html",
      url: "https://deepmind.google/blog/",
      category_hint: "研究論文"
    }
  },
  {
    json: {
      source: "Microsoft AI",
      source_type: "html",
      url: "https://blogs.microsoft.com/",
      category_hint: "AI 平台"
    }
  },
  {
    json: {
      source: "Meta AI",
      source_type: "html",
      url: "https://ai.meta.com/blog/",
      category_hint: "研究論文"
    }
  },
  {
    json: {
      source: "Hugging Face",
      source_type: "rss",
      url: "https://huggingface.co/blog/feed.xml",
      fallback_url: "https://huggingface.co/blog",
      category_hint: "開源專案"
    }
  },
  {
    json: {
      source: "GitHub Trending",
      source_type: "html",
      url: "https://github.com/trending",
      category_hint: "開源專案"
    }
  },
  {
    json: {
      source: "arXiv",
      source_type: "atom",
      url: "http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=20",
      category_hint: "研究論文"
    }
  },
  {
    json: {
      source: "Product Hunt",
      source_type: "graphql",
      enabled: false,
      url: "https://api.producthunt.com/v2/api/graphql",
      category_hint: "AI 工具"
    }
  }
];
```

Product Hunt 需要 API token；本機第一版先 `enabled: false`。

### 6. Split In Batches

用途：逐一處理來源，避免一次打太多請求。

設定：

- Batch Size: 1

### 7. Fetch Source

用途：抓取來源頁面、RSS 或 API。

用 `HTTP Request` node：

- Method: GET
- URL: `={{ $json.url }}`
- Response Format: Text
- Timeout: 30 seconds

Product Hunt 第二階段再加 GraphQL POST：

- Method: POST
- Header: `Authorization: Bearer {{PRODUCT_HUNT_TOKEN}}`
- Body: GraphQL query

### 8. Extract Candidates

用途：把不同來源格式整理成統一候選資料。

統一輸出欄位：

```json
{
  "title": "",
  "source": "",
  "source_url": "",
  "published_at": "",
  "raw_text": "",
  "image_url": "",
  "category_hint": ""
}
```

規則：

- 每來源最多取 `max_items_per_source`
- `source_url` 必須是完整 URL
- `raw_text` 至少 300 字或足夠描述
- 不要產出沒有 title 或 source_url 的 item

### 9. Quality Filter

用途：排除垃圾內容、低品質內容、非 AI 內容。

建議 `Code` node 規則：

- title 少於 8 字：排除
- raw_text 少於 200 字：排除
- URL 為空：排除
- title 或 raw_text 包含明顯廣告詞且無技術內容：排除
- 內容完全不含 AI / LLM / model / agent / machine learning / ChatGPT / Claude / Gemini 等相關詞：排除

### 10. Deduplicate

用途：在進 AI 前先省成本，最後仍由 ingest API 做資料庫去重。

去重規則：

1. 正規化 `source_url`：移除 `utm_*`、`ref`、尾端 `/`
2. 同一個 `source_url` 只保留第一筆
3. `lowercase(title) + source` 相同只保留第一筆
4. 標題高度相似且發布時間接近，只保留來源可信度較高者

### 11. AI Summary

用途：產生繁體中文摘要、完整重點、分類與 tags。

Prompt：

```text
你是「重啟實驗室 AI 情報中心」的編輯。請根據輸入內容，判斷是否值得收錄為 AI 情報。

請只輸出 JSON，不要加解釋，不要使用 Markdown。

規則：
- 使用繁體中文，台灣讀者自然可讀。
- 排除廣告、SEO 農場、重複轉載、低資訊量文章。
- 摘要要說清楚「發生什麼事」與「為什麼重要」。
- content 請整理成 3-6 個重點段落。
- 分類只能是：AI 平台、AI 工具、研究論文、技術趨勢、產品發布、開源專案、重大新聞。
- tags 3-8 個，使用短詞。

輸入：
title: {{$json.title}}
source: {{$json.source}}
url: {{$json.source_url}}
published_at: {{$json.published_at}}
category_hint: {{$json.category_hint}}
raw_text: {{$json.raw_text}}

輸出 JSON：
{
  "keep": true,
  "title": "",
  "summary": "",
  "content": "",
  "category": "",
  "tags": [],
  "reason": ""
}
```

### 12. AI Importance

用途：判斷 `importance_score` 與 `is_breaking`。

Prompt：

```text
請評估這則 AI 情報的重要程度。

請只輸出 JSON，不要加解釋，不要使用 Markdown。

評分 0-100：
- 90-100：重大模型、平台、政策、安全事件、產業級發布
- 75-89：重要產品發布、官方重大更新、熱門開源專案
- 55-74：值得追蹤的工具、研究、技術趨勢
- 0-54：一般內容，不建議收錄

is_breaking 只有在「24 小時內」且「對大量使用者或產業有立即影響」時才為 true。

輸入：
title: {{$json.title}}
summary: {{$json.summary}}
content: {{$json.content}}
category: {{$json.category}}
source: {{$json.source}}
published_at: {{$json.published_at}}

輸出 JSON：
{
  "importance_score": 80,
  "is_breaking": false,
  "reason": ""
}
```

### 13. IF - Publishable

用途：避免低品質內容寫入網站。

一般流程條件：

- `keep === true`
- `importance_score >= 55`
- `source_url` 存在
- `summary` 存在
- `content` 存在

重大消息流程條件：

- `keep === true`
- `importance_score >= 85`
- `is_breaking === true`
- `published_at` 在 24 小時內

### 14. Build Ingest Payload

用途：整理成你的 API 要的格式。

輸出：

```json
{
  "title": "{{$json.title}}",
  "summary": "{{$json.summary}}",
  "content": "{{$json.content}}",
  "category": "{{$json.category}}",
  "source": "{{$json.source}}",
  "source_url": "{{$json.source_url}}",
  "image_url": "{{$json.image_url || ''}}",
  "published_at": "{{$json.published_at}}",
  "importance_score": "{{$json.importance_score}}",
  "is_breaking": "{{$json.is_breaking}}",
  "tags": "{{$json.tags}}"
}
```

### 15. Send to Ingest API

用途：寫入 Supabase `public.ai_news`。

HTTP Request 設定：

- Method: POST
- URL: `http://localhost:3000/api/ai-news/ingest`
- Docker URL: `http://host.docker.internal:3000/api/ai-news/ingest`
- Content Type: JSON
- Header:

```text
Authorization: Bearer {{$env.AI_NEWS_INGEST_SECRET}}
Content-Type: application/json
```

Body 使用 `Build Ingest Payload` 的 JSON。

### 16. Log Result

用途：記錄每筆結果，方便除錯。

要保存：

- source
- source_url
- ok
- duplicated
- id
- message
- details
- code

## 重大新聞判斷規則

`is_breaking = true` 需要同時符合：

- `importance_score >= 85`
- 發布時間在 24 小時內
- 來源為官方、可信研究機構、GitHub 高熱度專案或主流科技媒體
- 對大量使用者、開發者、企業或產業有立即影響

優先視為重大新聞：

- 新 frontier model 發布
- OpenAI / Anthropic / Google / Meta / Microsoft 重大模型或 API 更新
- 價格、API、模型能力、使用限制重大變更
- 重大安全事件或政策監管事件
- 開源模型、agent 框架、推論工具快速爆紅

預設不視為重大新聞：

- 一般教學文章
- 小型產品更新
- 無明確影響範圍的工具上架
- 純行銷內容

## 正式上線前檢查清單

- `AI_NEWS_INGEST_SECRET` 已設定且足夠長
- n8n workflow 不把 secret 寫在公開備註或節點名稱
- 本機 smoke test 已成功寫入
- 重複執行同一 URL 會回 `duplicated: true`
- 每個來源都有 max items 限制
- Product Hunt token 未設定前保持停用
- 一般流程門檻為 `importance_score >= 55`
- 重大流程門檻為 `importance_score >= 85`
- 失敗結果會記錄 `message/details/hint/code`
- `/news` 可看到新增文章
- `/news/{id}` 詳細頁可正常打開

