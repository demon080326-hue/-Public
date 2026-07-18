# 第 7 階段 B-1 收尾檢查

檢查日期：2026-07-18（Asia/Taipei）

## 第 7 階段 B 狀態

- 程式：已完成，正式寄信 adapter、重新驗證 API、驗證碼雜湊、效期、錯誤上限與限流皆已建立。
- Vercel Email provider 環境變數：尚未設定。
- Resend 寄件網域：尚未完成驗證。
- Production 真實收信：尚未驗收。

Vercel Production 目前缺少以下必要變數：

- `RESEND_API_KEY`
- `AUTH_EMAIL_FROM`

可選變數為 `AUTH_EMAIL_REPLY_TO`、`AUTH_EMAIL_PROVIDER` 與 `APP_PUBLIC_URL`。任何 Secret 都不得寫入此文件、Git、Client Component 或 `NEXT_PUBLIC_` 環境變數。

## AI 情報更新檢查

### 檢查前

- `public.ai_news`：33 筆。
- 最新 `published_at`：2026-07-17 00:01:21（Asia/Taipei）。
- 最新 `created_at`：2026-07-17 07:17:41（Asia/Taipei）。
- 最近一次 GitHub Actions 排程：2026-07-16 11:59（Asia/Taipei），執行成功。
- 該次結果：3 個來源、抓取 15 筆、新增 0 筆、去重 15 筆、失敗來源 0。

當次沒有新增的原因是來源回傳的 15 個網址都已存在，既有 URL 去重流程正確跳過；不是 GitHub Actions、GitHub Secrets 或來源連線失敗。

### 手動收集

2026-07-18 使用既有指令執行：

```bash
npm run ai-news:collect
```

結果：

- 檢查來源：3。
- 抓取資料：15。
- 新增：2。
- 去重：13。
- 失敗來源：0。
- 失敗資料：0。

新增來源分別為 Hugging Face 與 OpenAI。執行後 `public.ai_news` 為 35 筆，最新 `published_at` 為 2026-07-17 23:57:54（Asia/Taipei），最新 `created_at` 為 2026-07-18 09:20:40（Asia/Taipei）。

Production `/news` 已顯示這兩筆最新資料。列表依既有 `getPublishedNews(limit = 24)` 設定顯示最新 24 則，因此前台顯示數量與資料庫總數不同是預期行為。

## GitHub Actions 結論

- Workflow：`AI News Collector`。
- 最近一次排程狀態：`completed / success`。
- `Check required secrets`：成功。
- `Collect AI news`：成功。
- Workflow、RSS 設定與收集腳本均未修改。

## 管理者帳號確認

`public.profiles` 角色分布：

- `owner`：1。
- `admin`：0。
- `member`：0。
- `pending_member`：0。

唯一具有 `owner` 或 `admin` 權限的帳號是 `demon080326@gmail.com`，角色為 `owner`。沒有修改任何會員角色。

## Production 回歸

- `/news`：正常，顯示最新 24 則，兩筆新資料已出現。
- `/news/[id]`：最新文章 UUID 詳細頁正常，原始來源連結存在。
- `/login`：正常，既有 owner session 可辨識。
- `/member`：顯示 `demon080326@gmail.com` 與 `owner`，管理權限已啟用。
- `/dashboard`：owner 可進入。
- `/admin`：owner 可進入。
- `/admin/news/new`：owner 可進入。
- 上述頁面未出現 Next.js runtime overlay 或水平溢出。

## 保護規則

- `demon080326@gmail.com` 是唯一 owner／管理者；未經明確授權不得降權。
- 其他帳號不得升級為 `admin` 或 `owner`。
- AI 情報自動化腳本、來源設定、去重流程與 GitHub Actions workflow 不得因本次檢查而修改。
- 第 7 階段 B Email 程式、文件與 Git 歷史不得包含任何 Secret。
