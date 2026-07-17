# 會員系統 A1：Supabase SSR Auth 骨架

> 完成日期：2026-07-18
>
> 範圍：Auth client、SSR session、callback、登入介面與管理頁安全阻擋。
> 本階段未建立資料表、migration、RLS、正式角色、點數帳本或金流。

## A1 已完成

- 沿用 `@supabase/ssr` 的 browser/server clients。
- 沿用 `NEXT_PUBLIC_SUPABASE_URL` 與 `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`。
- 使用 Next.js 16 `proxy.ts` 慣例刷新 Supabase Auth session cookie。
- server-side 以 `getUser()` 取得可信的目前使用者資料。
- 建立 `/auth/callback`，安全交換 PKCE code，並阻擋外部 redirect。
- `/login` 已支援 Email/密碼登入、Email/密碼註冊、忘記密碼通知與登出。
- 註冊確認信與密碼重設信交由 Supabase Auth 發送；UI 不顯示 token、測試碼或 Secret。
- `/member` 需要正式 Supabase session，並顯示 Email 確認狀態。
- 每日簽到、每週加點與點數紀錄仍明確標示為 localStorage MVP，不是正式會員資產。
- 未登入者造訪 `/dashboard`、`/admin`、`/admin/news/new` 會回到 `/login`。
- 已登入會員仍只會看到「管理員專用」安全提示；A1 沒有建立或假設 admin role。

## 新增與修改檔案

新增：

- `proxy.ts`
- `lib/supabase/middleware.ts`
- `lib/auth-user.ts`
- `app/auth/callback/route.ts`
- `components/member-auth-hub.tsx`
- `docs/MEMBER_SYSTEM_A1_AUTH_SSR.md`

修改：

- `app/login/page.tsx`
- `app/member/page.tsx`
- `components/member-hub.tsx`
- `app/legacy.css`
- `docs/MEMBER_SYSTEM_A0_READINESS.md`（只更新 A1 狀態）

既有 `lib/supabase/browser.ts` 與 `lib/supabase/server.ts` 已符合 A1 規則，因此沿用且沒有另建重複 client。

## Session 與 Cookie 流程

1. Browser client 透過 Supabase Auth 完成登入、註冊、忘記密碼與登出。
2. Supabase SSR 以套件管理的 cookie 流程保存 session，而不是自建 localStorage session。
3. `proxy.ts` 對頁面請求呼叫 `getClaims()`，在 token 需要更新時同步 request/response cookies。
4. Auth cookies 更新時一併套用 `Cache-Control: private, no-store` 等防快取 headers。
5. Server Components 使用 server client 的 `getUser()` 讀取目前使用者，不信任前端自報身分。

Next.js 16 已將 `middleware.ts` 慣例改名為 `proxy.ts`；本專案的「session refresh middleware」因此實作在根目錄 `proxy.ts`，邏輯位於 `lib/supabase/middleware.ts`。

## Auth Callback 安全

- callback 僅接受 Supabase 提供的 `code`，並在 server 端交換 session。
- `next` 只能使用站內絕對路徑，不接受 `//` 或外部 URL。
- callback 不允許把登入成功使用者直接送往 `/dashboard` 或 `/admin`。
- 錯誤訊息只使用通用的 `auth_callback_failed` 代碼，不輸出 token、Email、Supabase 錯誤細節或 Secret。

## 管理頁限制

A1 尚未建立 `profiles`、role table 或 RLS role policy，因此不能判斷 `admin`／`owner`。目前採取最保守行為：

- 未登入：阻擋並導向 `/login`。
- 已登入：只顯示管理員專用提示，不提供 CMS、AI 情報新增、編輯或刪除操作。
- 未來 A2/A3 建立 server-side role 與 AAL2 驗證後，才能開放管理功能。

## `/login` 操作方式

- 「登入」：以 Email 與密碼呼叫 `signInWithPassword()`，成功後前往 `/member`。
- 「註冊帳號」：檢查密碼長度與確認密碼後呼叫 `signUp()`，提示使用者到信箱完成確認。
- 「忘記密碼」：呼叫 `resetPasswordForEmail()`，不論帳號是否存在都顯示相同安全文案。
- 已登入：顯示目前 Email、Email 確認狀態、正式 Auth 連線狀態與登出按鈕。

## 忘記密碼範圍

A1 已呼叫 Supabase Auth `resetPasswordForEmail()` 並使用 `/auth/callback`。正式「輸入新密碼」頁與 session 全部撤銷策略留到後續階段；目前不自建 token table 或 6 位數重設碼。

## 環境變數

Auth SSR 只讀取下列既有 public 變數名稱：

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

本階段沒有讀取、輸出或修改 `SUPABASE_SERVICE_ROLE_KEY`，也沒有修改 `.env.local` 或 Vercel Secrets。

## A1 未完成且不得假裝完成

- 正式會員 profile／role 資料表與 RLS。
- admin／owner 角色與 AAL2/TOTP 後台授權。
- 正式點數 ledger、簽到資料表與兌換紀錄。
- 自訂 SMTP、正式寄信品牌模板與寄信驗收。
- 完整密碼重設頁、重新驗證與登入錯誤三次鎖定。
- 正式金流、訂單、下載授權與商城解鎖。

## 驗收路由

- `/login`
- `/member`
- `/auth/callback`
- `/dashboard`
- `/admin`
- `/admin/news/new`
- `/news`
- `/news/[id]`

本機測試指令：

```powershell
npm run build
npm run typecheck
npm run lint
npm run dev
```

未登入時，`/dashboard`、`/admin`、`/admin/news/new` 應回到 `/login?notice=admin-auth-required`；直接開啟沒有 code 的 `/auth/callback` 應回到 `/login?error=auth_callback_failed`。

## A2 建議

下一階段先建立最小 `profiles` 與可信的 server-side role 來源，配合 RLS 實作 `member`／`admin`／`owner` 權限；在 role 與 AAL2 驗證完成前，後台繼續維持全面阻擋。正式資料表、migration 與 RLS 必須另案審查，不屬於 A1。

> 後續狀態：A2 已於 2026-07-18 完成。實作與驗收詳見 `MEMBER_SYSTEM_A2_PROFILES_ROLES.md`。

## 官方參考

- [Supabase Server-Side Auth](https://supabase.com/docs/guides/auth/server-side)
- [Creating a Supabase SSR client](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase password-based Auth](https://supabase.com/docs/guides/auth/passwords)
- [Next.js Proxy convention](https://nextjs.org/docs/app/api-reference/file-conventions/proxy)
