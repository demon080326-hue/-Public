# Stage 11: 後台會員查詢系統

## 階段目標

提供 `owner` 與 `admin` 一個安全、唯讀的會員查詢入口，集中查看既有會員角色、Email 驗證、點數、階級及最近紀錄。本階段不提供任何會員資料修改能力。

## 新增頁面

- `/admin/members`：會員列表、Email 搜尋、角色／階級／驗證狀態篩選及分頁。
- `/admin/members/[id]`：單一會員基本資料、點數與階級資料、最近 10 筆點數紀錄及最近 10 筆階級紀錄。
- `/admin`、`/dashboard`：新增「會員查詢」入口。

## 新增 API

- `GET /api/admin/members`
  - 支援 `search`、`role`、`tier`、`email_verified`、`page`、`limit`。
  - 預設 `limit=20`，上限為 50。
- `GET /api/admin/members/[id]`
  - 只接受 UUID 格式的 profile user id。
  - 回傳白名單 profile 欄位、最近點數紀錄與階級紀錄。

## 權限規則

- 每個頁面與 API 都先呼叫既有 `requireAdminAccess()`。
- 未登入 API 回 401；已登入但不是 `admin`／`owner` 回 403。
- 頁面未登入導向 `/login?notice=admin-auth-required`。
- service／secret key 只透過既有 server-only admin client 使用，不會傳到瀏覽器。
- 一般會員不能查詢其他會員資料。

## 可查詢欄位

- Email、display name、role、Email 驗證狀態、account status。
- current tier、highest tier、minimum tier。
- points balance、lifetime earned points、total valid spend。
- profile created／updated time。
- 最近 10 筆 points ledger 與 tier history 的必要顯示欄位。

## 不可顯示欄位

任何 password、OTP、token、access token、refresh token、provider token、reset token、cookie、authorization、service role 或 Secret 都不會被查詢或回傳。

## Audit log 接入

- 會員列表查詢：`manual_admin_action`／`profile`／`admin_member_search`。
- 會員詳細檢視：`manual_admin_action`／`profile`／`admin_member_detail_view`。
- 搜尋紀錄只保存「是否有搜尋值」與安全篩選條件，不保存完整搜尋 Email。
- 詳細紀錄保存 target profile id／Email 與已檢視區塊。
- audit 寫入失敗不會阻斷查詢功能，敏感欄位仍由既有 sanitizer 排除。

## 測試方式

1. 未登入呼叫 `/api/admin/members`，確認回 401。
2. 一般會員呼叫 API，確認回 403。
3. owner 登入後開啟 `/admin/members`，搜尋 Email 並切換 role、tier、Email 驗證篩選。
4. 開啟會員詳細頁，確認點數與階級紀錄只讀顯示。
5. 檢查 `admin_audit_logs` 新增對應查詢紀錄，且沒有敏感 metadata。
6. 執行 `npm run build`、`npm run typecheck`、`npm run lint`。

## 尚未完成

- admin 調整點數
- admin 調整階級
- 刪除會員
- 封鎖會員
- 訂單查詢
- 消費紀錄
- 金流
- 會員匯出 CSV

## 下一階段建議

先規劃 admin 手動調整點數的雙重確認、原因必填、ledger 與 audit log 原子性，再開始任何可寫入的管理功能。

## 不動項目

- 不新增 migration 或資料表。
- 不修改 profiles、points、tiers、audit logs、AI 情報 schema 或 RLS。
- 不修改 owner role、admin access helper、Supabase server key 讀取方式。
- 不修改 AI 情報收集、寫入、去重與 GitHub Actions。
