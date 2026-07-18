# 第七階段 A：登入安全與 6 位數驗證基礎

## 1. 階段目標

本階段把登入錯誤紀錄、三次失敗後重新驗證、6 位數 Email OTP UI 與資料庫安全基礎接到既有 Supabase SSR Auth。所有權限判斷仍以伺服器 Session、`profiles.role`、RLS 與安全狀態為準，不使用 `localStorage` 決定會員或管理權限。

## 2. 新增資料表

- `public.auth_security_state`：每位 Auth 使用者一筆登入安全狀態。
- `public.login_attempts`：登入成功與失敗紀錄，只保存 Email/IP 的 SHA-256 雜湊。
- `public.auth_security_events`：重新驗證、登入與驗證碼事件稽核。
- `public.email_verification_codes`：自訂 6 位數驗證碼的雜湊基礎，不保存明碼。

既有 Auth 使用者已補上 `auth_security_state`，新使用者則由 `auth.users` trigger 自動建立。這項 trigger 不修改既有 `handle_new_user` 與 profile 角色流程。

## 3. 登入錯誤與成功規則

登入改由 `POST /api/auth/login` 在伺服器執行：

1. 密碼失敗時寫入 `login_attempts` 並增加 `failed_login_count`。
2. 連續第三次失敗時設定 `requires_reverification = true`。
3. 正確密碼登入會把 `failed_login_count` 歸零並更新 `last_successful_login_at`。
4. 若帳號已被標記重新驗證，正確密碼不會自行解除標記。
5. 完成 Email 重新驗證後，才由受限 RPC 清除標記。

登入錯誤一律顯示「帳號或密碼錯誤，請確認後再試。」，不透露 Email 是否存在，也不把 Supabase 原始錯誤回傳到前端。

## 4. Email 重新驗證流程

當 `requires_reverification = true`：

1. `/member`、`/dashboard`、`/admin`、`/admin/news/new` 會導向 `/login?notice=reverification-required`。
2. `/login` 顯示遮罩後的 Email 與 6 位數輸入欄。
3. 使用者按下寄送後，伺服器以 Supabase Auth `signInWithOtp` 寄送 Email OTP，並設定 `shouldCreateUser: false`。
4. 使用者輸入 6 位數代碼後，由伺服器呼叫 `verifyOtp`。
5. 驗證成功且回傳使用者與目前 Session 相同，才清除 `requires_reverification`。

驗證碼不會出現在網站、URL、前端狀態預設值、log 或正式 UI 提示中。

## 5. 自訂 6 位數驗證碼基礎

`email_verification_codes` 與兩個 service-role-only RPC 已建立，供未來接上自訂寄信服務：

- 建立時只接受 6 位數，使用 `pgcrypto` bcrypt 儲存 `code_hash`。
- 預設 10 分鐘到期。
- 最多嘗試 5 次。
- 新碼建立時會讓同用途舊碼失效。
- 成功後寫入 `consumed_at`，不可重複使用。

本階段沒有對外啟用自訂寄信端點，也不會把明碼傳到瀏覽器。Production 實際重新驗證目前使用 Supabase Auth 既有 Email OTP。

## 6. Server-side RPC 與權限

公開 RPC 都是 `SECURITY INVOKER` wrapper，只授權 `service_role` 執行；需要存取 `auth.users` 或繞過 RLS 的實作位於未公開的 `private` schema，並使用固定空白 `search_path`。

主要 RPC：

- `record_login_failure`
- `record_login_success`
- `record_auth_security_event`
- `clear_reverification`
- `create_email_verification_code`
- `verify_email_verification_code`

`anon` 與一般 `authenticated` 角色都不能執行這些 RPC。

## 7. RLS 規則

- `auth_security_state`：使用者只能讀取自己的安全狀態，不能直接新增、更新或刪除。
- `login_attempts`：一般使用者無法讀取或寫入。
- `auth_security_events`：一般使用者無法讀取或寫入。
- `email_verification_codes`：一般使用者無法讀取 `code_hash` 或寫入任何資料。
- 寫入與狀態變更只允許受保護的伺服器流程。

owner 與 admin 不會因登入安全流程被降級；角色仍由既有 A2/A3 規則管理。

## 8. 隱私與防帳號列舉

- Email 與 IP 在登入紀錄中使用 SHA-256 雜湊。
- 不保存登入密碼、OTP 明碼或 Supabase Secret。
- 登入失敗與忘記密碼皆使用通用文案。
- 前端不會根據錯誤內容判斷帳號是否存在。
- User Agent 最多保存 512 字元，事件 metadata 上限 8 KB。

## 9. 目前寄信方式

目前沿用 A0 已啟用的 Supabase Email Provider 與 Magic Link/OTP 模板，不新增 custom SMTP、Resend、SendGrid、Mailgun 或其他 Secret。若 Email 模板尚未輸出 `{{ .Token }}`，需在下一階段由專案擁有者於 Supabase Auth Email Templates 確認後，6 位數 OTP 信件才會顯示代碼。

## 10. 驗證結果

資料庫交易測試已覆蓋：

- 三次錯誤後 `failed_login_count = 3` 且要求重新驗證。
- 錯誤驗證碼不會通過。
- 正確驗證碼會消耗並清除重新驗證狀態。
- `code_hash` 不是明碼，且為 bcrypt 格式。
- 測試完成後 rollback，owner 角色、安全狀態與 AI 情報資料不變。
- `anon`、`authenticated` 無法執行安全 RPC；一般使用者無法讀取驗證碼資料或更新安全狀態。

## 11. 本階段限制

- 尚未設定 custom SMTP。
- 尚未建立自訂 6 位數 Email 寄送器。
- 尚未做正式 TOTP 2FA。
- 尚未做跨裝置風險評分、地理位置偵測或裝置信任。
- 尚未建立管理員安全事件檢視 UI。
- Supabase Auth 自身的寄送頻率與 OTP 到期時間仍由 Auth 後台控制。

## 12. 下一階段建議

先驗收 Production Email OTP 模板是否會顯示 `{{ .Token }}`，再決定沿用 Supabase Auth OTP 或接上 custom SMTP。完成寄信驗收後，才進入 TOTP/AAL2 與 admin/owner 強制 2FA，不應先擴充新的會員資料表。
