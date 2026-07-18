# 第 7 階段 B：6 位數 Email 寄送

## 目標

把第 7 階段 A 的登入安全重新驗證流程接上可替換的 Email provider。此階段只處理 6 位數重新驗證碼、寄信、基本限流與 `/login` 操作介面，不處理點數、商城、金流、CMS 或強制 2FA。

## Email provider adapter

- `lib/email/send-email.ts`：統一寄信介面與 server-side 環境檢查。
- `lib/email/providers/resend.ts`：第一版 Resend REST API adapter。
- `lib/email/templates.ts`：繁體中文 HTML 與純文字模板。
- API route 只依賴統一介面，未來可新增 SMTP、SendGrid 或 Mailgun adapter，不需要改驗證流程。
- Email provider key 僅在 Node.js server runtime 讀取，不使用 `NEXT_PUBLIC_` 前綴。

## 環境變數

Vercel Production 與需要測試的 Preview 環境需設定：

- `RESEND_API_KEY`：從 Resend 取得。
- `AUTH_EMAIL_FROM`：已完成網域驗證的寄件者，例如 `重啟實驗室 <no-reply@your-domain.example>`。
- `AUTH_EMAIL_REPLY_TO`：選填，客服回覆信箱。
- `AUTH_EMAIL_PROVIDER=resend`：選填；未設定時預設使用 Resend。
- `APP_PUBLIC_URL=https://public-zeta-pink.vercel.app`：選填，用於產生聯絡頁網址。

不要把任何真實 Key 寫進本文件、Git、client component 或 `NEXT_PUBLIC_` 變數。若 `RESEND_API_KEY` 或 `AUTH_EMAIL_FROM` 缺少，網站不會 crash，寄送 API 會回覆「驗證信服務尚未設定，請稍後再試。」

## 6 位數寄送流程

1. 登入連續失敗三次後，`requires_reverification` 變成 `true`。
2. `/login` 顯示遮罩 Email 與重新驗證介面。
3. Server 以密碼學安全亂數產生 6 位數驗證碼。
4. 資料庫只保存 bcrypt hash，有效時間 10 分鐘，最多嘗試 5 次。
5. 新碼建立時會作廢同用途的舊碼。
6. Resend adapter 寄出繁體中文 HTML 與純文字信件。
7. 驗證成功會消耗驗證碼、清除登入失敗次數與 `requires_reverification`，再要求使用者重新登入。
8. 驗證碼不會回傳 client、不會寫入 log，也不會顯示在 Production UI。

## API 安全規則

### `POST /api/auth/reverification/request`

- 接收 `email`。
- 帳號不存在或不需要重新驗證時，仍回覆相同的通用成功訊息。
- 不回傳 Email 是否存在、`user_id` 或驗證碼。
- 僅 server-side service role 與受限 RPC 能查找目標、建立雜湊碼及寫安全事件。
- 回應使用 `Cache-Control: private, no-store`。

### `POST /api/auth/reverification/verify`

- 接收 `email` 與 6 位數 `code`。
- 格式、帳號、過期、錯誤次數與錯碼都使用通用失敗訊息。
- 驗證成功後清除安全鎖定並登出目前 session，要求重新登入。
- 不回傳內部帳號識別碼或 raw error。

## Email 模板

- 主旨：`【重啟實驗室】你的 6 位數安全驗證碼`
- 品牌：重啟實驗室 James AI Build Log
- 用途：帳號安全重新驗證
- 顯示 6 位數驗證碼與 10 分鐘效期
- 提醒非本人操作可忽略，不回覆驗證碼、不提供密碼
- 僅包含聯絡頁連結，不含追蹤像素或行銷內容

## Rate limit

- 同一帳號兩次申請至少間隔 60 秒。
- 同一帳號 10 分鐘最多建立 3 次寄送請求。
- 重寄會作廢舊碼，只保留最新有效碼。
- 安全事件包含 `verification_code_requested`、`verification_email_sent`、`verification_email_failed` 與 `verification_rate_limited`。
- 前端顯示 60 秒重新寄送倒數；真正限制由資料庫交易鎖與 server-side 安全事件原子判斷，併發請求也不能繞過。

## Production 設定

1. 在 Resend 驗證寄件網域與寄件者。
2. 到 Vercel Project Settings > Environment Variables。
3. 新增本文件列出的變數名稱，不要把值提交到 Git。
4. 將變數套用至 Production；需要 Preview 測試時也套用 Preview。
5. 重新部署最新 `main`。

## 測試方式

未設定 provider 時：

1. 開啟 `/login`，確認頁面與既有登入、忘記密碼流程正常。
2. 重新驗證寄送 API 應安全回覆服務尚未設定，頁面不可 crash。
3. 確認 API response、browser console 與 server log 都沒有驗證碼或 Secret。

設定 provider 後：

1. 使用測試帳號觸發三次登入失敗。
2. 正確密碼登入後進入重新驗證區塊。
3. 寄送驗證碼並確認收到信件。
4. 輸入正確驗證碼，確認要求重新登入。
5. 確認 `failed_login_count = 0`、`requires_reverification = false`，安全事件完整。
6. 測試 60 秒冷卻、10 分鐘三封上限、過期與五次錯誤上限。

## 尚未完成

- Vercel Email provider 環境變數與 Resend 寄件網域驗證。
- 設定環境後的真實收信驗收。
- 強制 TOTP 2FA、正式點數、商城購買解鎖與 CMS 後端權限。

## 下一階段建議

完成 Resend 網域與 Vercel server-side env 設定後，先做單一測試帳號的真實寄信、限流與解除鎖定驗收，再開始其他會員功能。
