# 第一階段設定

## 1. 建立本地環境檔

在 `next-app/` 執行：

```powershell
Copy-Item .env.example .env.local
```

填入：

```env
NEXT_PUBLIC_SUPABASE_URL=https://你的-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=你的_publishable_key
SUPABASE_URL=https://你的-project-ref.supabase.co
SUPABASE_PUBLISHABLE_KEY=你的_publishable_key
SUPABASE_SECRET_KEY=你的_secret_key
SUPABASE_BUCKET=news-images
```

`SUPABASE_SECRET_KEY` 只留在 server 端，不可放在任何 `NEXT_PUBLIC_` 變數，也不可貼到聊天、README 或前端檔案。

## 2. Supabase 資料確認

確認 `public.ai_news` 已建立並有已發布資料。前端查詢只讀取：

- `is_published = true`
- `is_spam = false`
- `is_duplicate = false`

第一階段使用既有公開讀取政策；沒有新增或刪除資料庫政策。

## 3. 圖片狀態

目前既有 `ai_news` migration 沒有 `image_url` 欄位，因此第一階段先保留可擴充的 `image_url` 型別，但不會查詢不存在的欄位。下一階段再決定要用 Storage 路徑欄位或衍生 URL。

## 4. 本階段尚未完成

會員登入、管理後台 CRUD、圖片上傳、n8n、RSS 收集器、AI 摘要、排程與 Vercel 部署留到後續階段；此階段不會自行部署。
