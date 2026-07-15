# AI 情報自動收集流程

此文件只定義未來流程，這個專案目前不會自動爬取、排程或發布任何外部內容。

1. n8n 定時觸發。
2. 讀取 RSS、官方網站、GitHub、Hugging Face 與研究論文來源。
3. AI 判斷內容價值，並去除重複、垃圾與低品質資料。
4. 產生繁體中文摘要、分類與資料品質評分。
5. 重大消息在未來資料表支援後才標記為重大消息。
6. n8n 使用 `POST /api/ai-news/ingest` 寫入資料。
7. 呼叫時帶 `Authorization: Bearer <AI_NEWS_INGEST_SECRET>`。
8. 前台 `/news` 依發布時間讀取最新資料。

目前 `ai_news` 沒有 `status`、`importance_score` 或 `is_breaking` 欄位；在建立資料庫遷移前，流程不得寫入這些欄位。
