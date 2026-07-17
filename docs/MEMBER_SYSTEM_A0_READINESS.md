# 第六階段 A0：正式會員 Auth 上線前安全確認

> 文件狀態：A0 設計、唯讀盤點與 Supabase Dashboard 人工確認完成；已可進入 A1。
>
> 檢查日期：2026-07-18
>
> Production URL：https://public-zeta-pink.vercel.app
>
> A1 狀態：尚未開始，必須等待使用者明確指示。

本階段只確認正式會員系統的 Auth、安全與部署前提，不建立資料表、不執行 migration、不修改 Supabase Auth、不新增 API，也不改動現有會員 MVP、商城、後台與 AI 情報功能。

## A0 結論

正式會員系統採用以下基準：

1. Supabase Auth Email + Password 作為第一因素。
2. 註冊後必須完成 Email 6 位數 OTP，才能成為 `member`。
3. 密碼重設使用 Supabase Auth 內建 Password Recovery，不自建 token 系統。
4. member 的 TOTP 2FA 可選；admin 與 owner 強制使用 TOTP 並達到 AAL2。
5. 所有 session 使用 `@supabase/ssr` 的 PKCE／Cookie 流程；不得以 localStorage 會員資料授權。
6. 後台權限由 server-side 身分、最新角色、AAL2 與 RLS 共同決定。
7. 正式公開註冊前必須完成 SMTP、redirect allowlist、Email templates、rate limits 與安全通知設定。

## 唯讀盤點結果

### Supabase 專案

| 項目 | 結果 | 判定 |
| --- | --- | --- |
| 專案 | `網頁AI資訊` | 已找到正確專案 |
| Project ref | `qlvakynpqqfljciliunp` | 僅作設定辨識，不是 Secret |
| 區域 | `ap-northeast-2` | 正常 |
| 狀態 | `ACTIVE_HEALTHY` | 正常 |
| Postgres | 17，GA channel | 正常 |

### Auth 公開設定

透過 Supabase Auth 公開 settings endpoint 進行唯讀確認，未輸出任何 Key：

| 設定 | 目前狀態 | A0 判定 |
| --- | --- | --- |
| Email Provider | 已啟用 | 符合正式會員方向 |
| Signup | 允許 | 正式上線前仍需防濫用設定 |
| Email auto-confirm | 關閉 | 正確，會員必須先驗證 Email |
| Phone Provider | 關閉 | 第一版不需要 |
| 其他 OAuth Providers | 未啟用 | 第一版不需要 |
| TOTP／App Authenticator | 已啟用（Dashboard 人工確認） | 符合 admin／owner 強制 2FA 規劃 |
| SMS MFA | 關閉（Dashboard 人工確認） | 第一版不需要 |
| Enhanced MFA Security | 已開啟（Dashboard 人工確認） | 符合 A0 安全基準 |
| Passkeys | 不納入第一版 | Beta／後續評估，不影響 A0 |

### 專案程式基礎

| 項目 | 現況 | 第六階段 A 要做的事 |
| --- | --- | --- |
| `@supabase/ssr` | 已安裝 `0.12.2` | 沿用，不新增另一套 Auth client |
| `@supabase/supabase-js` | 已安裝 `2.110.5` | 沿用並保持 lockfile pinning |
| Browser client | 已有 `lib/supabase/browser.ts` | 用於前端 Auth 操作 |
| Server client | 已有 `lib/supabase/server.ts` | 用於 server-side 使用者與 session 驗證 |
| Auth callback | 尚未建立 | 建立 PKCE code exchange route |
| Session refresh proxy | 尚未建立 | 依 Next.js 16／Supabase SSR 官方方式建立 |
| Email 驗證頁 | 尚未建立 | 建立 6 位數 OTP UI 與 server flow |
| Password Recovery | 尚未建立 | 建立 forgot/reset 頁與 callback |
| 正式角色／profile | 尚未建立 | 留待階段 A migration，不在 A0 建立 |

### 環境變數名稱

本機已存在正式 Auth client 所需的公開變數名稱：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

server 端另有現行 AI 情報使用的 Supabase 私密變數。本次未讀取、輸出或修改任何值。正式會員前端不得使用 `SUPABASE_SERVICE_ROLE_KEY` 或其他 secret key。

Vercel CLI 目前未安裝，因此 A0 不透過 CLI 列出 Production 環境變數。線上 `/news` 能讀取 Supabase，僅能證明既有公開資料連線正常，不能取代 Auth redirect、SMTP 與 Email template 檢查。

## A0 Auth 決策

### 註冊與 Email 驗證

| 項目 | 決策 |
| --- | --- |
| 註冊方式 | Email + Password |
| Email 確認 | 必須，未確認為 `pending_member` |
| 驗證形式 | 6 位數 Email OTP |
| OTP 實作 | 優先使用 Supabase Auth Email Template 的 `Token`，不自建明文 code table |
| OTP 建議效期 | 10 分鐘；實作前在 Dashboard 確認可設定值 |
| 重寄冷卻 | 前端至少 60 秒；後端／Supabase rate limit 為最終依據 |
| 嘗試限制 | 建議單次 OTP 最多 5 次；失敗後要求取得新碼 |
| 帳號列舉防護 | 已存在與不存在 Email 使用相同文案與相近回應時間 |
| 驗證後角色 | server 將 `pending_member` 轉為 `member`，前端不能傳 role |

Email 文案不得顯示 OTP 於網頁、console、analytics 或 audit log。

### 密碼政策

| 項目 | A0 建議 |
| --- | --- |
| 最低長度 | 12 字元 |
| 複雜度 | 接受長密語，不強迫固定符號組合 |
| 洩漏密碼 | 若目前 Supabase 方案支援，啟用 leaked password protection |
| 前端顯示 | 密碼規則與強度提示，但 server/Auth 為最終判斷 |
| 保存方式 | 密碼只交給 Supabase Auth，應用資料庫與 log 不保存 |
| 錯誤訊息 | 「帳號或密碼錯誤，請確認後再試。」 |

### 登入錯誤與重新驗證

- 正式版連續錯誤 3 次後設 `requires_reverification`。
- 失敗次數、鎖定與事件由 server/database 記錄，不使用 localStorage。
- 第三次後顯示：「為了保護帳號安全，請先完成 Email 驗證後再登入。」
- Email 重新驗證完成後才可再次嘗試登入。
- 成功登入後原子清除失敗次數。
- 具體資料表與 server 邊界依 `MEMBER_SYSTEM_PLAN.md`，留待階段 A migration review。

### 忘記密碼

| 項目 | 決策 |
| --- | --- |
| 第一版方案 | Supabase Auth `resetPasswordForEmail`／Password Recovery |
| 自建 token table | 第一版不建立 |
| 成功提示 | 「如果這個 Email 已註冊，我們會寄出重設密碼通知。」 |
| Redirect | 僅允許正式 Production 與明確本機 callback URL |
| 重設成功 | 寄送安全通知，撤銷其他 refresh sessions，敏感操作重新驗證 session |

### Session 與 SSR

1. 採用 `@supabase/ssr` 預設 PKCE 與 Cookie 流程。
2. 建立 callback 後交換 auth code，更新 server/browser 共用 cookies。
3. server-side 受保護頁面取得可信任 user／claims，不讀 localStorage 會員資料。
4. session refresh 使用 Next.js 16 相容的 proxy 機制；實作時重新核對官方範例。
5. access token 建議維持短效；停權、密碼重設與高風險操作不能只等待 token 自然過期。
6. admin／owner 進入後台與高風險操作都要檢查 AAL2，必要時要求近期重新驗證。

### MFA 政策

| 角色 | 政策 | 未達要求時 |
| --- | --- | --- |
| member | TOTP 可選 | 可使用一般會員功能，不可取得後台權限 |
| admin | TOTP 強制 | 不顯示管理資料，API 回 403 並導向 MFA challenge |
| owner | TOTP 強制 | 不得管理角色、金流或系統設定 |

第二版 TOTP 使用 Supabase Auth `enroll`、`challenge`、`verify` 與 `getAuthenticatorAssuranceLevel()`。應用資料表不複製 TOTP secret；備用恢復碼如自行提供，只保存 hash。

## URL 與 Redirect Allowlist 確認結果

### Production

- Site URL：`https://public-zeta-pink.vercel.app`（已確認）
- `https://public-zeta-pink.vercel.app`
- `https://public-zeta-pink.vercel.app/login`
- `https://public-zeta-pink.vercel.app/auth/callback`

### Local development

- `http://localhost:3000`
- `http://localhost:3000/login`
- `http://localhost:3000/auth/callback`

以上 Site URL 與 Redirect URLs 已由使用者在 Supabase Dashboard 確認。不預設加入寬鬆的 Vercel preview wildcard。需要測試 Preview Auth 時，應加入明確且受控的 preview URL，測試完移除。所有 `redirectTo` 都必須從 server allowlist 選取，不能直接接受任意 query parameter。

`/auth/confirm` 與 `/auth/reset-password` 尚未建立，也尚未加入 allowlist；進入對應實作階段時，必須先建立明確路由並再次由使用者確認 redirect URL，不可由程式自動擴大 allowlist。

## Email 與 SMTP 上線門檻

Dashboard 已確認存在 `Confirm signup`、`Magic link or OTP`、`Reset password`、`Reauthentication` 四種 Email templates，目前先保留預設內容。Custom SMTP 尚未設定。

正式公開註冊前必須完成：

- [ ] 選定正式 SMTP provider。
- [ ] 驗證寄件網域、SPF、DKIM，並規劃 DMARC。
- [ ] 設定寄件者名稱與不可回覆／客服信箱。
- [ ] 確認註冊模板實際寄送 6 位數 token，不顯示測試碼。
- [x] Confirm signup、Magic link or OTP、Reset password、Reauthentication 模板存在。
- [ ] 正式文案、品牌與安全通知模板完成。
- [ ] 繁中為主；必要固定資訊提供英文／日文版本或語言分流策略。
- [ ] OTP、Recovery 與 resend rate limits 已確認。
- [ ] 測試收件、垃圾信、過期、重放與重寄流程。

Supabase 2026-06 changelog 提到 Free tier Email Template 自訂能力有變更，因此正式實作前必須再核對目前方案限制，不能假設測試環境的寄信能力適合 Production。

## 安全基準

- 不使用 `user_metadata` 判斷角色；角色只能來自可信任資料庫或受控 `app_metadata`。
- `TO authenticated` 不是完整授權，所有會員 RLS 必須再限制 `auth.uid() = user_id`。
- 管理頁、管理 API、RLS 都要檢查角色；admin／owner 再檢查 `aal2`。
- `service_role` 永遠不進 Browser Bundle、`NEXT_PUBLIC_*`、文件或 log。
- 所有公開 schema 新表先確認 Data API exposure，再建立 RLS 與最小 GRANT。
- Auth callback／reset route 防 open redirect、CSRF／Origin 問題與敏感 token logging。
- 登入與寄信端點加入 CAPTCHA／bot protection 的評估門檻。

## Security Advisor 唯讀結果

目前 Supabase Security Advisor 只有兩項 INFO：`public.ai_digests` 與 `public.ai_sources` 已啟用 RLS、但沒有 policy。這兩張表屬既有 AI 情報範圍，A0 不修改；未發現因本階段產生的新安全問題。

參考：[Supabase database lint 0008](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy)

## Supabase Dashboard 人工確認結果

A0 無法從公開 settings 安全讀出的項目，已由使用者本人於 2026-07-18 確認：

| 項目 | 確認結果 |
| --- | --- |
| Allow new users to sign up | 已開啟 |
| Confirm email | 已開啟 |
| Email Provider | Enabled |
| Site URL | 已設定為 Production URL |
| Redirect URLs | Production／Local base、login、auth callback 已加入 |
| Email templates | Confirm signup、Magic link or OTP、Reset password、Reauthentication 均存在 |
| Custom SMTP | 尚未設定；公開註冊前完成 |
| TOTP／App Authenticator | Enabled |
| SMS MFA | Disabled |
| Enhanced MFA Security | 已開啟 |

尚未確認或尚未完成的 SMTP、正式 Email 文案、rate limits、CAPTCHA、session timeout 與未來 reset／confirm redirects，不阻擋 A1 SSR Auth 骨架，但會阻擋正式公開註冊與寄信功能上線。

## A0 驗收狀態

| 驗收項目 | 狀態 |
| --- | --- |
| 正確 Supabase 專案已確認 | ✅ |
| Email Provider 已啟用 | ✅ |
| Signup 可用、auto-confirm 關閉 | ✅ |
| Auth client 套件與現有 client 已盤點 | ✅ |
| 註冊／OTP／Recovery／Session／MFA 政策已決定 | ✅ |
| Production／Local redirect 草案已完成 | ✅ |
| 沒有建立資料表或 API | ✅ |
| 沒有修改 Supabase、Secret 或現有功能 | ✅ |
| Dashboard Provider／URL／Templates／MFA 人工確認 | ✅ |
| A1 SSR Auth 骨架準備度 | ✅ 可開始，但尚未開始 |
| Custom SMTP／正式模板／寄信驗收 | ⬜ 公開註冊前完成 |
| Rate Limits／CAPTCHA／Session 最終值 | ⬜ 正式 Auth 上線前完成 |

## A0 後的最小下一步

A0 已具備進入 A1 的條件。A1 只建立正式 Supabase SSR Auth 骨架（session refresh proxy、auth callback 與安全的登入狀態讀取），暫不建立點數、商城、金流或管理員資料表。

目前不開始 A1；必須等待使用者明確要求。

## 官方參考

- [Supabase SSR Advanced Guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Supabase URL Configuration](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Email OTP](https://supabase.com/docs/guides/auth/auth-email-passwordless)
- [Supabase Password Security](https://supabase.com/docs/guides/auth/password-security)
- [Supabase Auth Rate Limits](https://supabase.com/docs/guides/auth/rate-limits)
- [Supabase CAPTCHA](https://supabase.com/docs/guides/auth/auth-captcha)
- [Supabase TOTP MFA](https://supabase.com/docs/guides/auth/auth-mfa/totp)
- [Supabase Product Security](https://supabase.com/docs/guides/security/product-security)

實作 A1 前必須重新核對 Supabase changelog 與 Next.js 16 的官方 SSR Auth 指引。
