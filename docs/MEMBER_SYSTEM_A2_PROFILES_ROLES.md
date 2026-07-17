# 會員系統 A2：Profiles 與角色權限基礎

> 完成日期：2026-07-18
>
> Supabase project ref：`qlvakynpqqfljciliunp`
>
> 範圍：會員 profile、角色、RLS、Auth trigger 與安全的前端角色判斷。本階段不包含正式點數、商城、金流、CMS 或 2FA。

## A2 目標

A2 將 A1 的 Supabase Auth session 接到可信的資料庫 profile。角色只能來自 `public.profiles.role`，不能由 localStorage、前端狀態或可編輯的 Auth user metadata 決定。

## 新增 Migration

- `20260717222716_profiles_roles_foundation.sql`
- `20260717223132_harden_profile_role_helper.sql`

兩個 migration 已套用到正確專案，遠端 migration history 與本機檔名一致。

第一個 migration 建立 profiles、trigger、function、RLS 與既有 Auth 使用者補建。第二個 migration 將 `SECURITY DEFINER` 角色查詢移至非公開 `private` schema，並合併 SELECT policies，以消除 A2 新增的 security/performance advisor 警告。

## `public.profiles`

| 欄位 | 型別 | 規則 |
| --- | --- | --- |
| `user_id` | `uuid` | Primary key，參照 `auth.users(id)`，刪除 Auth user 時 cascade |
| `email` | `text` | 由 Auth trigger 寫入，會員不可自行修改 |
| `display_name` | `text` | 會員唯一可自行更新的 profile 欄位 |
| `role` | `text` | 預設 `pending_member`，受 check constraint 保護 |
| `email_verified` | `boolean` | 預設 `false`，A2 不允許會員自行同步 |
| `points_balance` | `integer` | 預設 `0`，只保留欄位，點數功能尚未資料庫化 |
| `created_at` | `timestamptz` | 預設 `now()` |
| `updated_at` | `timestamptz` | 預設 `now()`，更新時由 trigger 維護 |

合法角色只有：

- `pending_member`
- `member`
- `admin`
- `owner`

## RLS 與欄位權限

`public.profiles` 已啟用 RLS。

### SELECT

`profiles_select_authorized` 允許：

- Auth 使用者讀取 `auth.uid() = user_id` 的本人 profile。
- 資料庫角色為 `admin` 或 `owner` 的使用者讀取 profiles，供未來後台使用。

`anon` 沒有 profiles SELECT 權限。

### UPDATE

`profiles_update_own_display_name` 只允許使用者更新自己的 row，並同時使用 `USING` 與 `WITH CHECK`。

RLS 只能限制 row，不能限制 column，因此 migration 額外採用 column-level GRANT：

- `display_name`：authenticated 可更新。
- `role`：authenticated 不可更新。
- `email_verified`：authenticated 不可更新。
- `points_balance`：authenticated 不可更新。
- `user_id`、`email`、timestamps：authenticated 不可直接更新。

一般會員無 INSERT 或 DELETE policy，也不能自行建立或刪除 profile。

## Trigger 與 Functions

### `public.handle_new_user()`

- 掛載於 `auth.users` 的 `AFTER INSERT` trigger：`on_auth_user_created`。
- 使用 `SECURITY DEFINER` 與空白 `search_path`。
- 只寫入 `new.id`、`new.email` 與可選 display name。
- `role` 固定為 `pending_member`。
- `email_verified` 固定為 `false`。
- `points_balance` 固定為 `0`。
- 已撤銷 `PUBLIC`、`anon`、`authenticated` 的直接執行權限。

### `private.current_user_role()`

- 放在非 Data API exposed schema，避免公開 RPC 暴露 `SECURITY DEFINER` function。
- 沒有輸入參數，只能依 `auth.uid()` 查詢呼叫者自己的 role。
- RLS policy 使用此 function 避免 profiles policy recursion。
- 未找到 profile 時保守回傳 `pending_member`。

### `public.get_current_user_profile()`

- 使用 `SECURITY INVOKER`，仍受 profiles RLS 約束。
- 只回傳目前 Auth 使用者自己的 profile。

### `public.set_profiles_updated_at()`

- 由 `profiles_set_updated_at` trigger 維護 `updated_at`。
- 會員無直接執行權限。

## Email 驗證同步

A2 前端同時顯示：

- Supabase Auth 的 `email_confirmed_at` 狀態，這是目前可信的 Email 確認來源。
- profiles 的 `email_verified` 欄位與「尚未同步」提示。

A2 不提供前端更新 `profiles.email_verified` 的能力。正式同步流程留給 A3 的 server-side 安全流程。

## 前端整合

`/login` 與 `/member` 會安全處理三種狀態：

- Profile 存在：顯示 role、display name、保留的 points balance 與驗證同步狀態。
- Profile 尚未建立：顯示「會員資料建立中，請重新整理或稍後再試」。
- Profile 查詢失敗：顯示同樣的保守提示，不輸出 raw Supabase error。

既有每日簽到、每週加點與點數紀錄仍是 localStorage MVP，沒有寫入 `points_balance`。

## 後台保護

`/dashboard`、`/admin`、`/admin/news/new` 採用兩層判斷：

1. 未登入：A1 proxy 導向 `/login`。
2. 已登入：Server Component 讀取 profiles role。

角色結果：

- `pending_member`：只顯示管理員專用提示。
- `member`：只顯示管理員專用提示。
- `admin`：顯示無操作功能的管理後台骨架。
- `owner`：顯示無操作功能的管理後台骨架。

A2 沒有恢復 CMS 新增、編輯、刪除按鈕，也沒有讓 localStorage 參與角色判斷。

## 第一個 Owner 指定方式

A2 沒有在 migration 硬寫任何 Email，也沒有自動指定 owner。完成註冊與 Email 確認後，由使用者本人在 Supabase SQL Editor 手動執行：

```sql
update public.profiles
set role = 'owner'
where email = '你的 Email';
```

執行前必須把 placeholder 換成自己的 Email，並確認只命中一筆 profile。Codex 本階段沒有執行此 SQL。

## 資料庫驗收結果

- `public.profiles`：存在，RLS 已啟用。
- Auth users：1。
- Profiles：1。
- `pending_member`：1。
- 一般會員可 SELECT 自己：通過。
- 一般會員可 UPDATE `display_name`：通過。
- 一般會員不可 UPDATE `role`：通過。
- 一般會員不可 UPDATE `email_verified`：通過。
- 一般會員不可 UPDATE `points_balance`：通過。
- `current_user_role()` 測試結果：`pending_member`。
- `get_current_user_profile()` 測試回傳：1 筆本人資料。
- `ai_news`：33 筆，未變更。
- `ai_sources`：0 筆，未變更。
- `ai_digests`：0 筆，未變更。

所有 UPDATE 行為測試都包在 transaction 並 `ROLLBACK`，沒有留下測試資料。

## 測試方式

```powershell
npm run build
npm run typecheck
npm run lint
npm run dev
```

路由驗收：

- `/login`
- `/member`
- `/dashboard`
- `/admin`
- `/admin/news/new`
- `/news`
- `/news/[id]`

Supabase 驗收需確認 table、constraint、grants、policies、functions、triggers、advisor 與 migration history。

## 尚未完成

- 實際指定第一個 owner。
- Profile Email verified 安全同步。
- Profile display name 編輯 UI。
- Admin 會員管理 UI。
- Email 6 位數自訂驗證。
- 密碼錯誤三次正式保護。
- Admin／owner 強制 2FA 與 AAL2。
- 正式點數 ledger、簽到、每週加點與兌換資料表。
- 商城、金流、購買、下載授權。
- CMS 正式後端權限。

## A3 建議

A3 優先完成 server-side profile 啟用與 Email verified 同步，再建立 admin／owner 的 AAL2/TOTP 強制保護。開始 A3 前先由使用者手動指定唯一 owner，且仍不得開放 CMS 寫入功能。

## 官方參考

- [Supabase Managing User Data](https://supabase.com/docs/guides/auth/managing-user-data)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase Column Level Security](https://supabase.com/docs/guides/database/postgres/column-level-security)
- [Supabase Securing Your API](https://supabase.com/docs/guides/api/securing-your-api)
