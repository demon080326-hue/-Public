# AI 情報接收 API

## 路徑

`POST /api/ai-news/ingest`

## 環境變數

在 `.env.local` 新增一個長的隨機字串：

```env
AI_NEWS_INGEST_SECRET=請填入一組只給 n8n 使用的長隨機字串
```

另外此 API 的資料庫寫入只在伺服器端使用：

```env
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

不要把 `SUPABASE_SERVICE_ROLE_KEY` 或 `AI_NEWS_INGEST_SECRET` 放進 n8n 以外的前端程式碼、GitHub 或公開文件。

## n8n Header

在 n8n 的 HTTP Request 節點設定：

```text
Method: POST
URL: http://localhost:3000/api/ai-news/ingest
Authorization: Bearer <AI_NEWS_INGEST_SECRET>
Content-Type: application/json
```

部署後再將 URL 改成正式網域；本階段不要啟動自動排程或爬蟲。

## 測試 JSON

`summary` 必填；如果來源流程只產出 `excerpt`，也可以用 `excerpt` 取代 `summary`，API 會寫入資料表的摘要欄位。

```json
{
  "title": "測試 AI 情報標題",
  "summary": "這是一段繁體中文摘要。",
  "content": "這是完整內容或重點整理。",
  "category": "AI 平台",
  "source": "OpenAI",
  "source_url": "https://example.com/unique-ai-news-url",
  "image_url": "",
  "published_at": "2026-07-15T00:00:00.000Z",
  "importance_score": 80,
  "is_breaking": false,
  "tags": ["OpenAI", "ChatGPT", "AI 情報"]
}
```

目前資料表使用 `url` 儲存 `source_url`、`ai_score` 儲存 `importance_score`；`is_breaking` 尚無資料表欄位，因此 API 不會寫入它。

## 成功回傳

```json
{
  "ok": true,
  "duplicated": false,
  "id": "新增文章 id",
  "url": "/news/新增文章id"
}
```

## 重複資料回傳

```json
{
  "ok": true,
  "duplicated": true,
  "message": "這篇 AI 情報已存在",
  "id": "既有文章 id"
}
```

## 下一階段 n8n 流程

1. n8n 排程觸發。
2. 讀取 RSS、官方公告、GitHub、Hugging Face 與研究論文。
3. 去除重複與低品質內容。
4. 產生繁體中文摘要、分類、標籤與重要程度。
5. 使用本 API 寫入 Supabase。
6. 前台 `/news` 自動顯示最新資料。
