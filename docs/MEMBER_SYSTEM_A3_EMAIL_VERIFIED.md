# 會員系統 A3：Email verified 正式同步

> 實作日期：2026-07-18
>
> Supabase project ref：`qlvakynpqqfljciliunp`
>
> 範圍：Auth Email 確認狀態同步、一般會員啟用、owner／admin 保護與會員頁狀態顯示。

## A3 目標

A3 以 Supabase Auth 的 `auth.users.email_confirmed_at` 為唯一可信 Email 驗證來源，安全同步到 `public.profiles.email_verified`。已驗證且角色仍為 `pending_member` 的使用者會升級為 `member`，其他角色不會被改寫。

本階段不建立點數、商城、金流、CMS、2FA 或自訂驗證碼資料表，也不修改 AI 情報流程。

## Email verified 同步規則

- `email_confirmed_at is not null`：`profiles.email_verified = true`。
- `email_confirmed_at is null`：`profiles.email_verified = false`，角色不升級。
- 同步只能由已登入使用者針對 `auth.uid()` 自己執行。
- RPC 不接受 `user_id`、Email、角色或驗證狀態參數。
- 前端不使用 service role，也不能直接更新 `email_verified`。

## pending_member 升級規則

同步時只有以下單向轉換：

```text
pending_member + Email 已確認 -> member
```

下列轉換永遠不會由 A3 執行：

- `member -> pending_member`
- `admin -> member`
- `admin -> pending_member`
- `owner -> member`
- `owner -> pending_member`

## Owner 與 Admin 保護

RPC 使用 `CASE`，只有角色等於 `pending_member` 且 Auth Email 已確認時才改為 `member`。`member`、`admin`、`owner` 都會保留原角色。

`/dashboard`、`/admin`、`/admin/news/new` 仍只允許 `admin` 與 `owner`。`pending_member` 與 `member` 只會看到管理員專用提示，不能取得 CMS 操作功能。

## Migration 與 Function

Migrations：

- `20260717233149_sync_profile_email_verification.sql`
- `20260717233614_harden_profile_email_verification_sync.sql`

新增 RPC：

```sql
public.sync_own_profile_from_auth()
```

最終安全設定：

- 零參數，不接受目標使用者或角色。
- 公開 RPC 使用 `SECURITY INVOKER`，只負責呼叫非 exposed schema 的 helper。
- 特權 helper 位於 `private` schema，使用 `SECURITY DEFINER`。
- 兩層函式都將 `search_path` 固定為空字串。
- 函式開頭要求 `auth.uid()` 不為 null。
- 只讀取同一個 `auth.users.id`。
- 只更新同一個 `profiles.user_id`。
- 建立後撤銷 `PUBLIC`、`anon`、`authenticated` 的預設權限。
- 僅重新授予 `authenticated` EXECUTE。
- 沒有授予 `anon`。
- 此分層避免在 Data API exposed schema 直接暴露 `SECURITY DEFINER` 函式。

## 前端整合

`lib/member-profile.ts` 的 `getCurrentMemberContext()` 新增選用的 `syncProfileFromAuth` 行為。只有 `/login` 與 `/member` 啟用同步；管理路由維持只讀 profile role，不依賴 localStorage 或 Auth user metadata。

登入成功後，瀏覽器使用目前使用者的 session 呼叫同一個零參數 RPC。RPC 失敗不會暴露原始資料庫錯誤，`/member` 的 server-side 載入仍會再次嘗試同步並安全回退到 profile 查詢。

## Member 顯示

`/member` 顯示：

- Auth Email。
- Auth Email 是否已確認。
- Profile `email_verified`。
- Profile 原始 role 與中文角色名稱。
- 會員啟用狀態。
- display name。
- `points_balance` 保留欄位與「尚未資料庫化」提示。

狀態文案：

- Email 未確認：請先到信箱完成 Email 驗證。
- `pending_member`：會員尚未正式啟用。
- `member`：正式會員已啟用。
- `admin`／`owner`：管理權限已啟用。
- Profile 缺少：會員資料建立中，請重新整理或稍後再試。

## Login 顯示

- 登入成功後先同步 profile，再前往 `/member`。
- Email 已確認且 `pending_member` 成功升級時，顯示「Email 已驗證，會員已正式啟用」。
- Supabase Auth 回傳 `email_not_confirmed` 時，顯示「請先到信箱完成 Email 驗證」。
- `owner`／`admin` 登入後仍前往會員中心顯示目前角色，不自動開啟後台。
- 註冊成功與忘記密碼流程沿用 A1。

## 後台權限影響

A3 不修改管理角色判斷函式。權限仍由 `public.profiles.role` 決定：

| 角色 | 後台權限 |
| --- | --- |
| `pending_member` | 無 |
| `member` | 無 |
| `admin` | 有 |
| `owner` | 有 |

## 測試方式

程式驗證：

```powershell
npm run build
npm run typecheck
npm run lint
```

資料庫驗證：

1. 函式存在且沒有參數。
2. 公開 RPC 為 `SECURITY INVOKER`；private helper 為 `SECURITY DEFINER`，兩者 `search_path` 均已固定。
3. `anon` 與 `PUBLIC` 沒有 EXECUTE。
4. `authenticated` 有 EXECUTE。
5. 未登入呼叫被拒絕。
6. owner 呼叫後 `role` 仍為 `owner`。
7. owner 的 Auth Email 已確認時，`email_verified` 變為 `true`。
8. 測試 `pending_member -> member` 時使用 transaction 並 rollback，不修改正式 owner。
9. 一般會員仍不能直接更新 `role`、`email_verified`、`points_balance`。
10. `ai_news` 筆數與資料不受影響。

路由驗收：

- `/login`
- `/member`
- `/dashboard`
- `/admin`
- `/admin/news/new`
- `/news`
- `/news/[id]`

## A3 驗收結果

- 兩個 migration 已套用至 `qlvakynpqqfljciliunp`，遠端 history 與本機檔名一致。
- 公開 RPC 無參數、使用 `SECURITY INVOKER`；private helper 使用 `SECURITY DEFINER`。
- `anon` 無 EXECUTE，`authenticated` 有 EXECUTE。
- `authenticated` 仍只能直接更新 `display_name`，不能更新 `role`、`email_verified` 或 `points_balance`。
- 唯一 owner 的 Auth Email 已確認，執行同步後 `profiles.email_verified = true`，角色仍為 `owner`。
- `pending_member -> member` 使用合成 Auth user 在 transaction 內驗證，測試通過後完整 rollback。
- 測試 user 與 profile 保留數量皆為 0。
- `ai_news` 驗收前後均為 33 筆，沒有修改 AI 情報資料。
- Supabase advisor 沒有因最終 A3 設計新增公開 `SECURITY DEFINER` 警告；其餘提示均為 A3 前已存在項目。

## 尚未完成

- 自訂 6 位數 Email 驗證。
- 密碼錯誤三次正式保護。
- Admin／owner 強制 2FA 與 AAL2。
- 正式點數 ledger、簽到與兌換資料表。
- 商城金流、購買與下載授權。
- CMS 正式後端權限。

## A4 建議

A4 建議先建立 Admin／owner 的 TOTP enrollment、AAL2 後台閘門與恢復碼政策。在強制 2FA 前，應先完成測試帳號、恢復流程與 owner 無法登入時的緊急處理程序。

## 官方參考

- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Function EXECUTE 權限](https://supabase.com/docs/guides/troubleshooting/how-can-i-revoke-execution-of-a-postgresql-function-2GYb0A)
- [Supabase Password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [Supabase JavaScript Error Handling](https://supabase.com/docs/guides/api/handling-errors-in-supabase-js)
