# 第 7 階段 B-3：登入 Callback 與 AI 情報來源

更新日期：2026-07-18

## 登入問題原因

Production 的 Supabase Auth log 顯示，確認信的一次性連結曾先被郵件預覽服務請求，之後使用者瀏覽器再開啟時，Supabase 回報 `One-time token not found`。Vercel callback 同時留下 `refresh_token_not_found`，因此舊版只處理 PKCE `code` 的 callback 最後導向 `/login?error=auth_callback_failed`。

這不是 Supabase Secret、會員角色或資料表結構問題。一次性驗證連結被預覽服務提前使用後不能再次交換 Session。

Vercel CLI 已只以名稱確認 Production 具備 `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`、`SUPABASE_SERVICE_ROLE_KEY` 與 `APP_PUBLIC_URL`；檢查過程未讀取或輸出任何值。

## 修正內容

1. `/auth/callback` 保留 PKCE `code` + `exchangeCodeForSession` 流程。
2. `/auth/callback` 新增 `token_hash` + `type` + `verifyOtp` 流程。
3. 新增 `/auth/confirm` 中介頁。信件預覽只會載入說明頁，真正驗證要由使用者按下「確認 Email」後，以 POST 送到 callback。
4. callback 失敗時只記錄階段、錯誤代碼、HTTP 狀態與非敏感訊息；不記錄 token、code、Session、Email 或 Secret。
5. `next` 仍限制為站內安全路徑，並禁止驗證信直接導向管理後台。

## Supabase Email Template 必要設定

到 Supabase Dashboard 的 **Authentication > Email Templates > Confirm signup**，將確認按鈕連結改為：

```html
<a href="{{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&amp;type=email&amp;next=/member">確認 Email</a>
```

不要在模板中放 API Key、Service Role Key 或其他 Secret。修改模板後必須重新寄送一封新的確認信；舊的一次性連結無法恢復使用。

## 新增 AI 情報來源

### Brief AI

- 來源頁：`https://ai.briefnewsletter.com/archive`
- 解析方式：HTML archive parser
- 只接受 `/p/` 文章連結
- 排除訂閱、廣告合作與非文章導覽
- 每次最多 3 筆
- 分類：`AI 電子報`

### AIBase AI 日報

- 來源頁：`https://news.aibase.com/tw/daily`
- 解析方式：HTML daily parser
- 只接受 `/tw/daily/{數字}` 的日報詳細頁
- 不接受產品庫、導覽列或其他站內連結
- 使用瀏覽器相容 request headers，遇到 429 或 5xx 最多重試 3 次
- 每次最多 3 筆
- 分類：`AI 日報`

兩個來源都沿用既有 `url` 去重、欄位偵測、逐來源錯誤隔離與 Supabase insert 流程。任一來源失敗不會中斷其他來源。

## 測試結果

### 第一次收集

- 執行：`npm run ai-news:collect`
- sources checked：5
- fetched items：21
- inserted：6
- skipped：15
- failed sources：0
- Brief AI：新增 3 筆
- AIBase AI 日報：新增 3 筆
- `public.ai_news`：35 筆增加為 41 筆

### 第二次收集（去重驗證）

- inserted：0
- skipped：21
- failed sources：0

### 應用程式驗證

- `npm run build`：成功
- `npm run typecheck`：成功
- `npm run lint`：0 errors，保留 4 個既有 `<img>` 效能 warning
- 本機 `/login`：HTTP 200
- 本機 `/auth/confirm`：HTTP 200
- 本機 `/news`：HTTP 200
- 無驗證資料的 `/auth/callback`：安全導回 `/login?error=auth_callback_failed`

## 尚未完成

Production 的新 Email confirmation 必須在 Supabase 更新 Confirm signup 模板後，以新寄出的確認信實測。舊確認信的一次性 token 已失效，不能用來驗收修正後流程。

## 使用者是否需要操作

需要一次 Supabase Dashboard 操作：更新 Confirm signup 模板為本文件提供的 `/auth/confirm` 連結，儲存後重新寄送確認信並按下新信件中的確認按鈕。不需要提供任何 Secret 給 Codex。
