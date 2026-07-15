# 重啟實驗室 AI 資訊平台（Next.js 第一階段）

這個 `next-app/` 是現有靜態網站旁邊的 Next.js App Router MVP。它先提供首頁、已發布 AI 情報列表與單篇情報頁，並以 Supabase 的 `ai_news` 做資料來源。

現有根目錄的 HTML、Netlify Functions 與資料流程保持不變。這個子專案完成驗證後，再決定是否取代正式入口。

## 開發

```bash
npm install
copy .env.example .env.local
npm run dev
```

開啟 `http://localhost:3000`。

## 驗證

```bash
npm run lint
npm run typecheck
npm run build
```

## 安全邊界

- 瀏覽器端只使用 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
- `SUPABASE_SECRET_KEY` 只可在 server-only 管理端 client 使用。
- 不要把 `.env.local`、真實金鑰或 service/secret key 提交到 GitHub。
- 第一階段不執行任何資料庫刪除、部署或權限放寬。
