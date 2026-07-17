# 重啟實驗室正式會員系統規劃

> 文件狀態：規劃稿，不代表功能已上線。
>
> 建立日期：2026-07-18
>
> 適用專案：重啟實驗室 James AI Build Log（Next.js App Router）

本文件只定義正式會員、權限、點數、商城與安全機制的目標架構。本階段不建立資料表、不執行 migration、不修改 Supabase Auth、不新增 API，也不改動現有登入、商城、後台或 AI 情報功能。

## 目前會員 MVP 狀態盤點

| 項目 | 現況 | 正式版限制 |
| --- | --- | --- |
| 註冊與驗證 | `components/member-hub.tsx` 以 localStorage 模擬 Email、密碼確認與 6 位數驗證 | 沒有建立 Auth 使用者、沒有寄信，不能視為正式驗證 |
| 會員狀態 | localStorage 保存 `verified`、點數與簽到日期 | localStorage 可被修改，永遠不能作為角色或權限依據 |
| 每日／每週點數 | 前端依日期限制並累加 | 沒有資料庫唯一約束、交易與稽核，不能防止竄改或跨裝置重複領取 |
| 管理頁 | `/dashboard`、`/admin`、`/admin/news/new` 顯示「管理員專用」安全提示 | 尚未有正式登入、角色判斷與 server-side guard |
| 管理 API | `/api/admin/news` 正式環境預設拒絕直接新增 | 未來仍需 server-side 身分、角色與 MFA 驗證 |
| 商城／下載 | UI、SSR 輸出與前端 runtime 都停用購買及解鎖 | 不可把商品內容放進公開 HTML，也不可用 localStorage 解鎖 |
| AI 客服 | 前端本機知識庫，只說明公開功能 | 不得讀取會員隱私、權限、點數或訂單資料 |

## 正式會員系統目標

1. 使用 Supabase Auth 管理 Email、密碼、驗證、Session 與 MFA。
2. 所有權限由可信任的 server-side 驗證、資料庫角色與 RLS 共同決定。
3. Email 未驗證者維持 `pending_member`，不取得簽到、點數、兌換或後台權限。
4. 點數以不可任意修改的 ledger 為帳本，`points_balance` 只作快取。
5. 購買與下載權限只能由已驗證的金流 webhook 或管理員流程建立。
6. 管理員操作完整記入 audit log，高風險操作要求 AAL2／2FA 與二次確認。
7. 會員不能透過前端參數、localStorage、JWT `user_metadata` 或直接呼叫 Data API 提升權限。

## 會員角色設計

| 角色 | 狀態與可用功能 | 禁止事項 |
| --- | --- | --- |
| `visitor` | 瀏覽公開首頁、AI 情報、工具與文章 | 不可簽到、累積點數、兌換、購買解鎖或進後台 |
| `pending_member` | 已註冊但 Email 尚未驗證，可重新要求驗證 | 不得取得正式會員權限或進後台 |
| `member` | Email 已驗證，可使用會員中心、簽到、每週加點、查看自己的點數與兌換狀態 | 不可進後台，不可管理 CMS、AI 情報、會員、訂單或權限 |
| `admin` | 可進管理後台、管理 CMS／AI 情報、查看必要會員資料、處理點數與兌換 | 不可建立或移除 owner；不得繞過稽核與 2FA |
| `owner` | 最高管理者，可管理 admin、商品、權限、金流設定與系統設定 | 仍需 2FA、二次確認與完整 audit log |

角色的權威來源應是不可由會員自行修改的資料庫欄位或可信任的 `app_metadata`。禁止使用 Supabase `user_metadata`、URL 參數、Cookie 自訂字串或 localStorage 作授權判斷。若角色放入 JWT，必須考慮角色變更後 JWT 尚未刷新造成的舊權限，敏感操作仍應查詢最新資料庫角色。

## 管理員權限設計

| 功能 | visitor | pending_member | member | admin | owner |
| --- | --- | --- | --- | --- | --- |
| `/dashboard`、`/admin` | 拒絕 | 拒絕 | 拒絕 | 允許，需 2FA | 允許，需 2FA |
| CMS／AI 情報管理 | 拒絕 | 拒絕 | 拒絕 | 允許 | 允許 |
| 查看會員必要資料 | 拒絕 | 拒絕 | 僅自己 | 最小必要範圍 | 允許 |
| 調整點數／兌換 | 拒絕 | 拒絕 | 拒絕 | 允許並留 audit log | 允許並留 audit log |
| 管理 admin／owner | 拒絕 | 拒絕 | 拒絕 | 拒絕 | 僅 owner |
| 金流與系統設定 | 拒絕 | 拒絕 | 拒絕 | 視個別權限 | 僅 owner |

正式版必須同時具備：Next.js server-side route guard、API 身分與角色檢查、Supabase RLS，以及高風險操作的 MFA AAL2 檢查。前端隱藏按鈕只改善體驗，不構成安全控制。

## Email 註冊與 6 位數驗證流程

### 註冊

1. 使用者輸入 Email、密碼與確認密碼。
2. 前端只做格式與密碼規則提示；真正規則由 Supabase Auth／server 再驗證。
3. 呼叫 Supabase Auth 建立待驗證帳號，不在自建表保存密碼。
4. 預設角色為 `pending_member`，不可由前端傳入角色。
5. 使用 Supabase Email Template 的 token 產生 6 位數 Email OTP；驗證碼不可顯示在前端、log 或 audit metadata。
6. OTP 必須有短效期、重送冷卻、每日上限與錯誤嘗試上限。
7. 驗證成功後，由可信任的後端流程把 profile 狀態轉為 `member`，並建立正式 session。
8. 所有回覆避免透露 Email 是否已註冊。

若最後採用 Supabase Auth 內建 Email OTP，`email_verification_codes` 不必自行建立；如因產品流程需要自建，僅保存 `code_hash`，並由 server 驗證、原子增加 `attempts`、設定 `used_at`。

### 登入與導向

1. Email + 密碼由 Supabase Auth 驗證。
2. 未驗證者導向 Email 驗證流程，不建立正式會員權限。
3. `member` 導向 `/member` 或會員中心。
4. `admin`、`owner` 必須再完成 MFA，達到 AAL2 後才導向 `/dashboard`。
5. 登入成功後清除正式後端記錄的失敗次數；不得只清 localStorage。

## Supabase Auth 規劃

- 使用 `@supabase/ssr` 的 Server Client／Browser Client 分工，敏感頁面在 Server Component、Route Handler 或 middleware-like proxy 層取得可信任使用者。
- 前端只使用 publishable／anon key；`service_role` 永遠只存在受控 server 環境。
- Email + 密碼、Email OTP、Password Recovery 與 TOTP 優先使用 Supabase Auth 內建能力。
- 設定 Production Site URL、允許的 redirect URLs、Email Template、OTP 效期、重送限制與 SMTP。
- 授權資料不得放在使用者可編輯的 `user_metadata`；可使用資料庫角色或受控 `app_metadata`，並處理 JWT 更新延遲。
- 任何暴露於 Data API 的 `public` table 都必須啟用 RLS；新表是否自動暴露還要依 Supabase Data API 設定確認。
- 密碼重設或停權後不可假設現有 access token 立即失效；敏感操作要重新確認 session／AAL，並規劃 session revoke 與較短 JWT 壽命。

## 會員資料表規劃

以下僅是 schema 草案，不在本階段建立。

| 資料表 | 用途與主要欄位 | 誰可讀 | 誰可寫 | RLS 方向 | 第一版 |
| --- | --- | --- | --- | --- | --- |
| `profiles` | `user_id`, `email`, `display_name`, `role`, `email_verified`, `points_balance`, timestamps | 會員自己的列；admin/owner 必要範圍 | 使用者只可改白名單欄位；角色、驗證、點數由 server | `auth.uid() = user_id`；禁止會員改 role／balance | 必要 |
| `admin_role_assignments` | `id`, `user_id`, `role`, `granted_by`, `revoked_at`, timestamps | admin 看必要資訊；owner 全部 | 僅 owner 的 server 流程 | member 無 policy；owner + AAL2 | 管理員上線前必要 |
| `email_verification_codes` | `id`, `user_id`, `code_hash`, `expires_at`, `used_at`, `attempts`, `created_at` | 一般使用者不可直接讀 | 僅 server | 無 client policy；若用內建 OTP 則不建立 | 可選 |
| `member_points_ledger` | `id`, `user_id`, `type`, `points`, `reason`, `reference_id`, `created_at` | 會員自己的紀錄；admin/owner | 僅 server/admin，append-only | 自己 SELECT；禁止 client INSERT/UPDATE/DELETE | 點數正式化時必要 |
| `daily_checkins` | `id`, `user_id`, `checkin_date`, `points`, `created_at` | 會員自己；admin | 透過 server/RPC 建立 | 唯一 `(user_id, checkin_date)`；不可自行指定 points | 簽到階段必要 |
| `weekly_bonus_claims` | `id`, `user_id`, `week_start_date`, `points`, `created_at` | 會員自己；admin | 透過 server/RPC 建立 | 唯一 `(user_id, week_start_date)` | 每週加點階段必要 |
| `reward_items` | `id`, `title`, `description`, `points_required`, `stock`, `status`, timestamps | 已發布商品可公開／會員讀 | admin/owner | 公開只讀 active；管理寫入需 AAL2 | 兌換階段必要 |
| `reward_redemptions` | `id`, `user_id`, `reward_item_id`, `points_spent`, `status`, timestamps | 會員自己的兌換；admin | server 建立；admin 更新履約狀態 | 會員不可自行改點數／狀態 | 兌換階段必要 |
| `products` | `id`, `title`, `description`, `price`, `status`, timestamps | active 商品可公開 | admin/owner | 公開 SELECT active；管理寫入需 AAL2 | 商城階段必要 |
| `purchases` | `id`, `user_id`, `product_id`, `payment_provider`, `payment_status`, `unlocked_at`, `created_at` | 會員自己的訂單；admin | 僅 webhook/server/admin | client 不可 INSERT 或改成功狀態 | 金流階段必要 |
| `downloads_access` | `id`, `user_id`, `download_id`, `source_type`, `source_id`, `unlocked_at` | 會員自己的權限；admin | 僅 server/admin | client 只讀自己的列 | 下載正式化時必要 |
| `admin_audit_logs` | `id`, `actor_user_id`, `action`, `target_type`, `target_id`, `metadata`, `created_at` | owner；admin 依需求只讀 | 僅 server append | member 無權限；不可 update/delete | 後台上線前必要 |
| `auth_security_state` | `user_id`, `failed_login_count`, `locked_until`, `requires_reverification`, `last_failed_login_at`, timestamps | 使用者可看精簡狀態；admin/owner | 僅 auth server | 不允許 client 修改 | 正式登入第一版必要 |
| `auth_security_events` | `id`, `user_id`, `event_type`, `ip_hash`, `user_agent_hash`, `metadata`, `created_at` | owner/security admin | 僅 server append | member 無直接權限 | 正式登入第一版建議 |
| `login_attempts` | `id`, `email_hash`, `user_id`, `success`, `reason`, `created_at` | owner/security admin | 僅 server append | member 無直接權限；定期保留／清理 | 正式登入第一版建議 |
| `password_reset_tokens` | `id`, `user_id`, `token_hash`, `expires_at`, `used_at`, `created_at` | 不提供 client 讀取 | 僅 server | 無 client policy；內建 recovery 則不建立 | 不建議第一版 |
| `user_mfa_settings` | `id`, `user_id`, `mfa_enabled`, `method`, `factor_id`, `backup_codes_hash`, timestamps | 使用者自己；admin 看狀態不看秘密 | Supabase Auth/server | 不保存 TOTP secret；自己只讀安全欄位 | 第二版可選 |
| `mfa_challenges` | `id`, `user_id`, `challenge_type`, `expires_at`, `verified_at`, `created_at` | 使用者自己的安全狀態；admin 最小範圍 | Supabase Auth/server | 一般 client 不直接建立或驗證 | 內建 MFA 時通常不需自建 |

### 關鍵資料一致性

- `auth.users.email_confirmed_at` 是 Email 驗證的主要來源；`profiles.email_verified` 如保留，只能由 server 同步，不能由會員寫入。
- `member_points_ledger` 是點數真實帳本；`profiles.points_balance` 是可重算的快取。
- 簽到、加點、ledger、balance 必須在同一資料庫交易中完成。
- 兌換時要鎖定／原子檢查點數與庫存，避免競態條件造成負點數或超賣。
- `email_hash`、`ip_hash` 應使用 server 端帶秘密 pepper 的 HMAC，不保存可逆明文。

## 管理員角色資料表規劃

第一版可以先以 `profiles.role` 作為權威角色，只有 owner 的 server action 可以修改；開始支援多管理員、撤銷、歷史追蹤後，再加入 `admin_role_assignments`。所有升降權都寫入 `admin_audit_logs`。

RLS 若需要查詢角色，應使用受控的 private schema helper 或安全的角色查詢，避免 `profiles` policy 自我遞迴。若必須使用 `SECURITY DEFINER`，函式不得放在 exposed `public` schema，需固定 `search_path`、撤銷 `PUBLIC EXECUTE`、明確授權、檢查 `auth.uid()`，並接受安全 advisor 檢查。

## 每日簽到、每週加點與點數紀錄規劃

### 每日簽到

1. Server 依固定時區（Asia/Taipei）計算資料庫日期。
2. 唯一約束 `(user_id, checkin_date)` 防止同日重複。
3. 同一交易新增 `daily_checkins`、ledger 正點數與更新 balance。
4. API 重送需具 idempotency；唯一衝突回覆「今日已簽到」，不重複加點。

### 每週加點

1. Server 計算週一為 `week_start_date`。
2. 唯一約束 `(user_id, week_start_date)`。
3. 同一交易新增 claim、ledger 與 balance。

### Ledger

- 每次增減必須有 `type`、`reason` 與可追蹤的 `reference_id`。
- ledger 不更新、不刪除；更正用反向分錄。
- 管理員手動調整必須填原因並寫入 audit log。

## 商品兌換資料表規劃

兌換流程：驗證已登入會員 → 檢查 `reward_items.status` → 原子檢查點數與庫存 → 建立 `reward_redemptions` → 寫入負點數 ledger → 更新 balance／庫存 → 回傳 pending 狀態。管理員後續處理交付，所有狀態變更記入 audit log。第一版只做數位或人工交付，正式物流另行規劃。

## 商城購買與解鎖資料表規劃

1. `products` 只負責商品展示與可售狀態。
2. 使用者點購買時建立付款流程，但未付款不建立解鎖權限。
3. 付款成功只能以支付商簽章驗證通過的 webhook 為準。
4. webhook 需具 idempotency，驗證金額、幣別、商品與訂單狀態。
5. 交易內建立／更新 `purchases`，成功後才建立 `downloads_access`。
6. 付款失敗、取消、金額不符或簽章錯誤皆不得解鎖。
7. 前端僅查詢 server／RLS 允許的 access；localStorage 不參與正式權限。
8. 付費檔案放私有 Storage bucket，使用短效 signed URL；不得直接藏在公開 HTML 或 `public/`。

## 下載權限資料表規劃

下載頁只顯示會員可見的 access metadata。真正下載時由 server 重新驗證 session、`downloads_access` 與商品狀態，再產生短效 signed URL。分享 URL 過期後失效；高價內容可記錄下載事件與速率限制。

## CMS 後台權限規劃

- `/dashboard`、`/admin`、`/admin/news/new` 與未來會員／商品／兌換管理頁都先在 server 驗證使用者。
- `visitor`、`pending_member`、`member` 導回 `/login` 或顯示「管理員專用」，且 API 仍回 401／403。
- `admin`、`owner` 需角色符合且 MFA 達 AAL2。
- CMS、AI 情報、會員、點數、兌換、商品與權限變更都不能只靠前端判斷。
- AI 情報既有 ingest 自動化維持獨立，不與一般會員 session 混用。

## RLS 安全規則規劃

以下是規則方向，不是可直接執行的 SQL。

| 資料表 | SELECT | INSERT | UPDATE／DELETE |
| --- | --- | --- | --- |
| `profiles` | `auth.uid() = user_id`；admin/owner 另走受控 policy | profile 由註冊 trigger/server 建立 | 會員只能改 display name 等白名單；role、verified、balance 禁止 |
| `admin_role_assignments` | admin 最小讀、owner 全讀，均需 AAL2 | 僅 owner server | 僅 owner server；撤銷需 audit |
| 驗證／安全相關表 | client 原則不直接讀，必要時只給精簡自己的狀態 | server only | server only；事件與 attempts append-only |
| `member_points_ledger` | 自己的列 | server/admin only | 禁止更新／刪除 |
| `daily_checkins`、`weekly_bonus_claims` | 自己的列 | 僅透過受控 server/RPC | 禁止會員更新／刪除 |
| `reward_items`、`products` | public／authenticated 僅 active | admin/owner + AAL2 | admin/owner + AAL2 |
| `reward_redemptions` | 自己的列；admin 管理 | server transaction | 會員不可改；admin 更新狀態並 audit |
| `purchases` | 自己的列；admin 管理 | webhook/server only | webhook/admin only，付款狀態不可由會員改 |
| `downloads_access` | 自己的列 | webhook/server/admin only | server/admin only |
| `admin_audit_logs` | owner；admin 按最小需要 | server append-only | 禁止 update/delete |

每個 ownership policy 都要同時指定 `TO authenticated` 與 `(select auth.uid()) = user_id`；只有 `TO authenticated` 會形成越權風險。UPDATE policy 同時需要 `USING` 與 `WITH CHECK`。admin/owner 的高權限 policy 還需檢查最新角色與 JWT `aal = aal2`，不能只看前端狀態。

## API Route 規劃

| Route 草案 | 方法 | 用途 | 安全要求 |
| --- | --- | --- | --- |
| `/api/auth/register` | POST | 註冊協調、建立 pending profile | 通用回覆、rate limit、不可接受 role |
| `/api/auth/resend-verification` | POST | 重寄 Email OTP | `shouldCreateUser: false`、冷卻與總量限制 |
| `/api/auth/reverify` | POST | 錯誤三次後重新驗證 | server 清除 reverify 狀態；通用回覆 |
| `/api/auth/forgot-password` | POST | 觸發 Supabase recovery | 永遠回相同成功文案、rate limit |
| `/api/member/checkin` | POST | 每日簽到 | verified member、DB transaction、idempotent |
| `/api/member/weekly-bonus` | POST | 每週加點 | verified member、DB transaction、idempotent |
| `/api/member/rewards/redeem` | POST | 商品兌換 | verified member、點數／庫存原子檢查 |
| `/api/checkout/create` | POST | 建立付款流程 | verified member、商品／金額由 server 取得 |
| `/api/webhooks/payment` | POST | 接收金流結果 | 驗證簽章、idempotency、不可依賴瀏覽器資料 |
| `/api/downloads/[id]` | POST | 產生短效下載 URL | session + access 查詢 + rate limit |
| `/api/admin/*` | 依功能 | 後台操作 | admin/owner + AAL2 + audit log + CSRF/origin 防護 |

本階段不建立以上 Route。

## 前端頁面調整規劃

- `/login`：登入、註冊、重寄驗證、忘記密碼入口與一致的通用錯誤文案。
- `/auth/verify`：6 位數 Email OTP、倒數、重寄冷卻與錯誤次數提示。
- `/auth/reset-password`：處理 recovery session、設定新密碼與成功通知。
- `/member`：正式 profile、驗證狀態、點數、簽到、每週加點、紀錄、兌換與訂單。
- `/marketplace`：商品展示與正式付款狀態；功能未上線前維持「暫未開放」。
- `/downloads`：只根據 server 回傳的 access 顯示下載，不接收 localStorage 解鎖。
- 所有頁面要保留現有三語主 UI、Header、Footer、AI 客服與響應式行為。

## 後台頁面調整規劃

- `/dashboard`：管理總覽與安全狀態。
- `/admin/members`：會員查詢、停權、驗證狀態；顯示最少必要個資。
- `/admin/points`：點數調整與 ledger，不可直接改 balance 而不留分錄。
- `/admin/rewards`：兌換商品與履約管理。
- `/admin/products`：商品與售價管理。
- `/admin/purchases`：只處理例外與退款，不手動假造付款成功。
- `/admin/audit`：owner 查閱高風險操作紀錄。
- 所有管理操作由 server-side 授權；UI 按鈕隱藏不是權限控制。

## 登入安全與錯誤次數限制

### 正式規則

1. 密碼連續錯誤 3 次後，把帳號安全狀態設為 `requires_reverification = true`。
2. 要求重新完成 Email 6 位數驗證，成功後才能再次嘗試密碼登入。
3. 計數、鎖定與重新驗證狀態存在 server/database，不使用 localStorage。
4. 成功登入後原子歸零 `failed_login_count`、清除鎖定狀態。
5. OTP 重寄要有 email hash、IP 與時間窗限制，避免郵件轟炸。
6. 未知帳號與已存在帳號使用相同回覆與相近處理時間，避免帳號列舉。

建議一般錯誤顯示：「帳號或密碼錯誤，請確認後再試。」

第三次錯誤後顯示：「為了保護帳號安全，請先完成 Email 驗證後再登入。」

### 第一版資料策略

第一版建議使用：

- `auth_security_state` 保存每個已知使用者的目前計數與 reverify 狀態。
- `login_attempts` 保存經 HMAC 的 Email、成功與原因，供限流與調查。
- `auth_security_events` 保存重要事件，例如第三次失敗、OTP 重寄、重新驗證成功與 MFA 失敗。

不建議把這些欄位直接混在可由會員更新的 `profiles`，可避免 RLS 白名單錯誤。若為了第一個極小版本先放 `profiles`，必須將安全欄位完全排除於會員 UPDATE policy，且盡快拆出。

為確保三次限制不能被繞過，正式登入需經過受控 server 邊界；同時，所有敏感 API 仍要查 `requires_reverification`。只在 UI 阻擋登入不安全，直接呼叫 Supabase Auth 或舊 session 可能繞過畫面。

## 忘記密碼流程

1. `/login` 提供「忘記密碼」。
2. 使用者輸入 Email；無論帳號是否存在都顯示：「如果這個 Email 已註冊，我們會寄出重設密碼通知。」
3. 第一版使用 Supabase Auth `resetPasswordForEmail`／Password Recovery link，並只允許已登記的 redirect URL。
4. recovery session 驗證成功後，使用者才能設定新密碼。
5. 新密碼遵守長度、洩漏密碼與重複密碼政策；正式規則由 Auth/server 執行。
6. token 由 Supabase Auth 管理效期與一次性流程，不輸出到 log。
7. 重設成功後撤銷其他 refresh sessions；敏感 API 對尚未過期 access token 仍應重新驗證 session，不能假設立即全部失效。
8. 寄出「密碼已變更」通知信，提供非本人操作的處理方式。

### 方案比較

| 方案 | 優點 | 風險／成本 | 建議 |
| --- | --- | --- | --- |
| Supabase Auth 內建 recovery | 密碼與 token 由 Auth 管理、成熟、較少敏感表 | 需正確設定 redirect、SMTP、template 與 session 撤銷 | 第一版採用 |
| 自建 6 位數 reset code | UI 可完全客製 | 需自行處理 hash、效期、重放、猜碼、限流、session revoke，風險高 | 第一版不採用 |

`password_reset_tokens` 只在確定無法使用內建 recovery 時才規劃；永遠只保存 `token_hash`，不得保存明文 token。

## 雙重驗證 2FA 規劃

### 角色要求

| 角色 | 2FA 規則 |
| --- | --- |
| `member` | 可選；鼓勵啟用 TOTP，未啟用仍不能取得管理權限 |
| `admin` | 強制；未達 AAL2 不得讀取或操作後台 |
| `owner` | 強制；管理角色、金流與系統設定前可再要求近期驗證 |

### 第一版

- Email 6 位數驗證。
- 異常登入或密碼錯誤 3 次後重新驗證。
- 這是 Email re-verification，不等同抗釣魚的完整 MFA。

### 第二版

- 使用 Supabase Auth 內建 TOTP MFA：`enroll` → QR Code → `challenge` → `verify`。
- 登入後以 Authenticator App 輸入 6 位數 TOTP。
- 使用 `getAuthenticatorAssuranceLevel()` 檢查是否達 `aal2`。
- 規劃一次性備用恢復碼，只保存 hash；顯示後不再回傳明文。
- 恢復／停用 MFA 屬高風險操作，需要重新驗證與通知信。

第一版不自建 `totp_secret_encrypted`。Supabase Auth 已管理 TOTP factor 與 challenge，應避免在應用資料表複製秘密。`user_mfa_settings` 若建立，只保存政策、factor id、狀態與備用碼 hash；`mfa_challenges` 通常也交由 Supabase Auth 管理。

## 後台高風險操作安全

1. admin／owner 進入後台前必須通過 2FA，JWT／session assurance level 為 AAL2。
2. visitor、pending_member、member 一律不能進後台；前端、server route 與 RLS 三層都拒絕。
3. 管理操作寫入 `admin_audit_logs`，包含 actor、action、target、結果、必要 metadata 與時間。
4. 修改會員點數、兌換狀態、商品售價、付款狀態、下載權限、admin 權限與系統設定都屬高風險。
5. 高風險操作需二次確認；涉及角色、金流或大量資料時要求近期 MFA／密碼再驗證。
6. audit metadata 不保存密碼、OTP、TOTP secret、完整支付資料或 Secret Key。
7. audit log append-only，禁止一般 admin 刪除或改寫；owner 也應透過保留政策處理，不直接刪資料。

## 測試與驗收清單

### Auth 與角色

- [ ] Email + 密碼可註冊，未驗證保持 pending_member。
- [ ] OTP 過期、錯誤、重放、重寄冷卻與上限都正確。
- [ ] member 無法透過 request body、localStorage 或 user_metadata 升級角色。
- [ ] 密碼錯誤 3 次後要求重新驗證，成功登入後計數歸零。
- [ ] 忘記密碼對存在／不存在 Email 顯示相同文案。
- [ ] 密碼重設後舊 refresh session 失效。
- [ ] admin／owner 未達 AAL2 無法進後台或呼叫管理 API。

### RLS 與資料

- [ ] member 只能讀自己的 profile、ledger、簽到、訂單、兌換與下載權限。
- [ ] member 不能改 role、email_verified 或 points_balance。
- [ ] 同一天／同一週重送只加點一次。
- [ ] 點數與庫存在競態測試下不會負數或超賣。
- [ ] 付款失敗、偽造 webhook、重送 webhook 都不會錯誤解鎖。
- [ ] 管理高風險操作都有完整 audit log。
- [ ] RLS Tester／安全 advisor 無高風險警告。

### 前端與回歸

- [ ] `/login`、`/member`、`/dashboard`、`/admin`、`/marketplace`、`/downloads` 手機與桌機正常。
- [ ] Header、Footer、三語 UI 與 AI 客服不受影響。
- [ ] `/news`、`/news/[id]` 與 AI 自動化完全不受影響。

## 實作順序

| 階段 | 目標 | 預計修改範圍 | 建表 | 使用者需操作 Supabase | 驗收與完成後保護 |
| --- | --- | --- | --- | --- | --- |
| A | Supabase Auth 與 profiles | Supabase clients、auth callback、登入／會員頁 | profiles | 啟用 Email Auth、URL／SMTP 設定 | 正式 session 與 profile；保護 Auth 基礎設定 |
| B | Email 6 位數驗證 | verify UI、resend server flow | 視是否用內建 OTP | Email Template、OTP 效期／限流 | pending 無正式權限；保護驗證流程 |
| C | 角色與後台保護 | server guards、admin routes、API auth | role assignment、audit | 建立第一位 owner | member 永不進後台；保護角色與 AAL2 |
| D | 會員中心正式化 | `/login`、`/member` | 無或 profile 擴充 | 無 | 移除 localStorage 權威；保護會員資料 |
| E | 簽到與每週加點資料庫化 | member APIs/UI | checkins、weekly claims | migration／RLS review | 重送不重複；保護唯一約束 |
| F | 點數 ledger | points service/admin view | ledger | migration／RLS review | 每筆點數可追蹤；保護 append-only ledger |
| G | 兌換商品 | reward UI/API/admin | rewards、redemptions | migration／RLS review | 原子扣點與庫存；保護兌換流程 |
| H | 商城解鎖正式化 | marketplace/downloads | products、access | Storage private bucket | localStorage 永不解鎖；保護 access |
| I | 金流 webhook | checkout、webhook | purchases | 金流商設定與 webhook Secret | 驗簽／idempotency；保護付款真實來源 |
| J | 後台會員管理 | admin pages/APIs | audit 補強 | 建立 admin、MFA 政策 | 高風險操作可稽核；保護管理流程 |

建議在 A 之前先做「A0：登入安全設計確認」，決定 Email OTP template、失敗次數 server 邊界、密碼 recovery、session revoke 與 admin MFA 政策，避免後續重做 Auth 流程。

## 風險與注意事項

- localStorage MVP 資料不可直接匯入成正式點數、驗證或購買紀錄。
- Supabase Auth session 與 RLS 必須一起設計；只有登入沒有資料列授權仍可能造成 BOLA／IDOR。
- `app_metadata` 比 user metadata 安全，但 JWT 可能過期前仍帶舊角色；高風險操作查最新資料。
- Data API 是否暴露新表與 RLS 是兩個不同控制，都要確認。
- Email OTP、忘記密碼與登入失敗訊息都要避免帳號列舉。
- 6 位數碼可猜測空間有限，必須短效、限次、冷卻與 rate limit。
- SSR Cookie、redirect allowlist、CSRF／Origin、防止 open redirect 都需測試。
- 付費內容不能出現在公開 HTML、前端 bundle 或 `public/`。
- 正式金流前維持「暫未開放」，不得建立假付款或測試解鎖後門。
- 稽核與登入事件要有保留期限、個資最小化與 hash key 輪替規劃。

## 哪些事情現在不能做

- 不建立任何上述資料表、constraint、trigger、function 或 RLS policy。
- 不執行 migration，不修改 Supabase Auth、Email Template、SMTP 或 URL 設定。
- 不新增登入、驗證、忘記密碼、MFA、點數、金流或下載 API。
- 不把 service role、SMTP、支付或其他 Secret 寫入程式碼或文件。
- 不開放商城、付款、下載、點數兌換或後台功能。
- 不修改 AI 情報頁、查詢、資料、收集、去重、寫入或 GitHub Actions。

## 哪些事情要使用者本人操作

正式實作各階段時，使用者需在 Supabase／Vercel／金流後台完成：

1. 確認 Supabase Auth Email Provider、Site URL、redirect allowlist。
2. 設定正式 SMTP、寄件網域、Email OTP／Recovery／安全通知模板。
3. 確認 OTP 效期、rate limits、密碼政策與 CAPTCHA／防濫用設定。
4. 審閱 migration 與 RLS 後才允許套用，並建立第一位 owner。
5. admin／owner 本人完成 TOTP 綁定與備用恢復碼保管。
6. 金流階段本人建立商家帳號、設定 webhook 與 Secrets；Secret 只放後台，不貼到對話或 Git。
7. 每階段部署後執行正式 Email、MFA、付款與權限驗收。

## 官方參考

- [Supabase Password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [Supabase Passwordless Email / Email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase Password Recovery](https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail)
- [Supabase TOTP MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp)
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Product Security](https://supabase.com/docs/guides/security/product-security)

實作前必須重新核對當時的 Supabase changelog 與官方文件，因 Auth、Data API、MFA、SDK 與 Dashboard 設定可能變動。
