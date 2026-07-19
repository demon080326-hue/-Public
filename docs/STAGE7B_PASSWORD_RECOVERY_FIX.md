# Stage 7B Password Recovery Fix

## 狀態

- Supabase Custom SMTP 已修好。
- 使用者已收到 Supabase 忘記密碼信。
- owner 帳號 `demon080326@gmail.com` 已確認可以收到忘記密碼信。
- `/recover` 不再是 `535 Authentication credentials invalid`。
- 忘記密碼信可進入 `/reset-password`。
- 本次補強 `otp_expired`、無效連結與缺少 recovery session 的畫面狀態。

## 問題原因

原本 `/login` 的忘記密碼流程呼叫 `resetPasswordForEmail()` 後，`redirectTo` 指向 `/auth/callback?next=/login`。

Supabase Password Recovery 只會寄出重設密碼連結。使用者點擊連結後，網站必須提供一個可輸入新密碼的頁面，並在 recovery session 存在時呼叫：

```ts
supabase.auth.updateUser({ password: newPassword })
```

原本專案缺少 `/reset-password` 頁面，所以使用者收到信後無法完成新密碼設定。

## 修正內容

- 新增 `/reset-password` 頁面。
- 新增 `ResetPasswordForm` 前端元件。
- `/login` 忘記密碼 redirect 改為 `/reset-password`。
- `/reset-password` 支援直接收到 `code` 後交換 recovery session。
- `/reset-password` 檢查：
  - 新密碼至少 8 碼。
  - 兩次密碼必須一致。
  - 沒有 recovery session 時不能更新密碼。
  - URL hash 或 query 出現 `access_denied`、`otp_expired`、invalid 或 expired 時，不顯示密碼表單。
  - 失效連結顯示「重設密碼連結已失效或過期，請回登入頁重新申請忘記密碼。」
  - 沒有有效 recovery session 時顯示「請先從最新的重設密碼信件進入此頁。」
  - 只有 recovery 連結或 `PASSWORD_RECOVERY` 事件建立有效 session 後才顯示可操作表單。
- 更新成功後：
  - 顯示成功狀態。
  - `signOut()` recovery session。
  - 導向 `/login?notice=password-updated`。
- `/auth/confirm` 支援 `type=recovery` 的 token hash 中介頁。
- `/auth/callback` 針對 recovery flow 回傳：
  - `/login?error=recovery_failed`
  - `/login?error=recovery_expired`
- `/login` 顯示：
  - `password-updated`：密碼已更新，請使用新密碼登入。
  - `recovery-expired`：重設密碼連結已失效或過期，請重新申請忘記密碼。
  - `recovery_failed`：重設密碼連結已失效，請重新申請。
  - `recovery_expired`：重設密碼連結已過期，請重新申請。

## Supabase Redirect URLs

正式測試前，Supabase Auth Redirect URLs 必須包含：

- `https://public-zeta-pink.vercel.app/reset-password`
- `http://localhost:3000/reset-password`

如果缺少，請到 Supabase Dashboard：

Authentication → URL Configuration → Redirect URLs

新增以上網址後再重新寄送忘記密碼信。不要重用舊信。

## 測試方式

1. 前往 `/login`。
2. 點「忘記密碼」。
3. 輸入 owner Email。
4. 收到新的重設密碼信。
5. 點擊信件中的連結。
6. 進入 `/reset-password`。
7. 測試密碼太短，應顯示錯誤。
8. 測試兩次密碼不一致，應顯示錯誤。
9. 輸入合法新密碼。
10. 成功後導向 `/login?notice=password-updated`。
11. 使用新密碼登入。
12. 舊密碼不可登入。

## 尚未完成

- 正式自訂寄件網域驗證仍暫停。
- 一般會員註冊信仍可能受限於尚未驗證正式寄件網域，待第 7 階段 B-4 正式網域驗證後再完整驗收。
- 尚未自建密碼重設 token 資料表；第一版仍使用 Supabase Auth Password Recovery。
- 尚未做強制撤銷所有其他 session 的進階流程。
