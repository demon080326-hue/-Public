# Stage 8 Admin / Owner Access Control

## 階段目標

第 8 階段目標是把管理後台從前端 MVP 提升為 server-side 權限防線：

- `/dashboard`
- `/admin`
- `/admin/news/new`
- `/api/admin/news`

這一階段不修改資料庫結構、不建立 audit log 資料表、不修改 AI 情報自動收集流程、不修改 Supabase Auth callback / SMTP / Email template。

## 風險與保護範圍

受保護項目：

- `.env.local`
- Supabase Secret / GitHub Secrets / Vercel env
- Supabase schema 與既有資料
- `public.ai_news`、`public.ai_sources`、`public.ai_digests`
- AI 情報 collector、去重、GitHub Actions 排程
- `/news` 與 `/news/[id]` 查詢邏輯
- `/auth/callback`、Confirm signup template、Supabase SMTP
- owner 帳號 `demon080326@gmail.com`

本階段只處理管理頁與 admin API 的 server-side 權限判斷。

## Admin Helper 設計

新增 `lib/admin-access.ts`，集中管理後台權限判斷。

提供函式：

- `getCurrentAuthUser()`
- `getCurrentProfile()`
- `getCurrentRole()`
- `isAdminRole(role)`
- `requireAdminAccess()`
- `requireOwnerAccess()`
- `getAdminAccessState()`

`requireAdminAccess()` 檢查條件：

1. Supabase Auth user 必須存在。
2. `public.profiles` 必須存在。
3. role 必須是 `admin` 或 `owner`。
4. Auth email 與 profile `email_verified` 必須為已驗證。
5. `auth_security_state.requires_reverification` 必須不是 `true`。
6. 不使用 localStorage。
7. 不信任 client 傳入的 role。

回傳狀態：

- `unauthenticated`
- `profile_missing`
- `email_unverified`
- `reverification_required`
- `forbidden`
- `allowed`

## 後台頁面保護

已套用 server-side gate：

- `app/dashboard/page.tsx`
- `app/admin/page.tsx`
- `app/admin/news/new/page.tsx`

行為：

- 未登入：導向 `/login?notice=admin-auth-required`
- `member` / `pending_member`：顯示管理員專用阻擋頁
- Email 未驗證：顯示 Email 驗證提示
- 需要重新驗證：顯示重新驗證提示
- `admin` / `owner`：可進入管理頁

## Admin API 保護

已保護：

- `app/api/admin/news/route.ts`

行為：

- 未登入：`401 AUTH_REQUIRED`
- 非 admin / owner：`403 ADMIN_REQUIRED`
- Email 未驗證：`403 EMAIL_UNVERIFIED`
- 需要重新驗證：`403 REVERIFICATION_REQUIRED`
- Profile 缺失：`403 PROFILE_MISSING`

注意：

- `/api/ai-news/ingest` 是 AI 情報自動收集專用 Bearer Token API，本階段未修改。
- Production 的 CMS 寫入仍維持關閉，避免誤改正式資料。

## 權限矩陣

| Role | /dashboard | /admin | /admin/news/new | admin API |
| --- | --- | --- | --- | --- |
| owner | 允許 | 允許 | 允許 | 允許 |
| admin | 允許 | 允許 | 允許 | 允許 |
| member | 阻擋 | 阻擋 | 阻擋 | 403 |
| pending_member | 阻擋 | 阻擋 | 阻擋 | 403 |
| 未登入 | 導向 login | 導向 login | 導向 login | 401 |

## 唯一 Owner 規則

目前唯一 owner / 管理者帳號：

- `demon080326@gmail.com`

其他帳號不得升級為 `admin` / `owner`。若未來新增 admin，必須由 owner 明確操作並納入 audit log。

## 尚未完成

本階段刻意不建立以下正式功能：

- `admin_audit_logs` 資料表
- 2FA 強制導入
- 正式 CMS 資料表
- 購買、下載、金流、商品 webhook
- 管理員二次確認流程

## 下一階段建議

下一階段建議先建立 `admin_audit_logs` 與高風險操作記錄規則，再逐步開放真正的 CMS / 點數 / 商品管理功能。
