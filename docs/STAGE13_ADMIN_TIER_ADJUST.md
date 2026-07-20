# 第 13 階段：Admin 手動調整會員階級

## 目標

讓 `owner` 與 `admin` 能在會員詳細頁安全調整會員的 `current_tier`，並保留不可刪除的 `member_tier_history` 與後台 `admin_audit_logs`。本階段只調整會員階級，不處理點數、`lifetime_earned_points`、消費、訂單、金流或商品。

## 新增 API

- `POST /api/admin/members/[id]/tier-adjust`
- Request：`targetTier`（合法階級 key）、`reason`（5-300 字）。
- 回應只包含 `memberId`、`beforeTier`、`afterTier`、`highestTier`，不回傳憑證、token、cookie 或其他敏感欄位。

錯誤碼：

| 情境 | HTTP |
| --- | --- |
| 未登入 | 401 |
| 非 owner／admin | 403 |
| 會員不存在 | 404 |
| `targetTier` 不合法 | 400 |
| `reason` 少於 5 字或超過 300 字 | 400 |
| 目標階級與目前階級相同 | 400 |
| admin 嘗試設定 `royal_relative`／`royal_direct`／`king` | 403 |
| 已有其他會員是 `king` | 400 |
| Server 或資料庫錯誤 | 500（不含 SQL、Secret 或憑證） |

## 新增 UI

`/admin/members/[id]` 新增「手動調整會員階級」區塊：

- 目標階級為下拉選單（不可自由輸入任意字串）；admin 登入時皇室階級選項會被停用並標示「限 owner」。
- 原因必填，5-300 字。
- 即時預覽：目前階級、調整後階級、`highest_tier` 是否會往上更新，並明示 `points_balance`、`lifetime_earned_points`、`minimum_tier` 都不會改變。
- 送出中停用表單，成功後清空原因並重新整理資料。

UI 不出現調整點數、刪除會員、封鎖會員、修改 role、升為 admin／owner、訂單或金流。

## 顯示名稱

下拉選單沿用全站既有 `getTierLabel()`／`MEMBER_TIER_LABELS`（超級窮、貧民、平民、商人、貴族、皇民、皇親、皇族、國王），以維持與會員列表、會員詳細頁的一致顯示，並在每個選項附上英文 key，避免同一頁出現兩套名稱。

## 權限規則

- 頁面及 API 都沿用既有 `requireAdminAccess()`，不新增 / 修改 owner、admin 判斷。
- 一般 `member`、`pending_member` 與未登入訪客不可使用。
- `owner` 與 `admin` 可調整一般階級：`super_poor`、`poor`、`commoner`、`merchant`、`noble`、`royal_citizen`。
- 只有 `owner` 可調整高權限皇室階級：`royal_relative`、`royal_direct`、`king`。
- 權限在三層把關：UI 停用、API `canActorAssignTier()` gate、RPC `p_actor_role` 防禦性檢查。
- 前端不直接更新 Supabase；所有寫入只在 server-side API 與 service-role-only RPC 執行。

## 階級調整規則

- 只調整 `current_tier`。
- `highest_tier` 只能往上更新（目標階級排序高於目前 `highest_tier` 時才提高），永遠不降低。
- 不調整 `minimum_tier`、`points_balance`、`lifetime_earned_points`、`total_valid_spend`。
- 不自動升級、不自動降級、不處理購買保底商人、不處理長期未購買降級 cron。
- 目標階級與目前階級相同時拒絕（避免產生無意義的紀錄）。

## king 唯一性（資料庫層保護）

- Migration 建立 partial unique index `profiles_single_king_idx`：`current_tier = 'king'` 同時間只能有一筆。
- RPC 內另有 pre-check，若已有其他會員是 king 會先回 `KING_ALREADY_EXISTS`，unique index 為最終保底。
- `king` 只是會員階級，與 `owner`／`admin` 系統權限完全無關，不混用。
- Migration 套用前會先檢查現有資料；若 Production 已有超過一位 king，migration 會以 `STAGE13_MULTIPLE_KINGS_PRESENT` 主動報錯並停止，不會強制破壞資料。

## RPC / transaction

資料庫函式 `admin_adjust_member_tier(p_target_user_id, p_target_tier, p_reason, p_actor_user_id, p_actor_email, p_actor_role)` 在同一個 PostgreSQL transaction 內：

1. 驗證 actor 身分與 role、目標階級合法性、reason 長度、owner-only 皇室階級限制。
2. `for update` 鎖定 target profile。
3. 讀取 before `current_tier` / `highest_tier` / `minimum_tier`。
4. 檢查 king 唯一限制。
5. 更新 `profiles.current_tier`，`highest_tier` 只在需要時往上更新。
6. 插入一筆 `member_tier_history`。
7. 回傳 before / after 階級、`highest_tier`、`history_id`。

任一步失敗整個交易回滾，不留半套資料。

## member_tier_history

依既有 schema 寫入，不改欄位：

- `old_tier`：調整前 `current_tier`
- `new_tier`：調整後 `current_tier`
- `reason`：`manual_adjustment`（既有 enum 值）
- `changed_by`：操作管理員 user id
- `metadata`：`source = admin_manual_adjustment`、`adjusted_by_user_id`、`adjusted_by_email`、`adjusted_by_role`、`previous_tier`、`new_tier`、`previous_highest_tier`、`new_highest_tier`、`minimum_tier_unchanged`、`points_unchanged`、`lifetime_unchanged`、`stage = stage13_admin_tier_adjust`

## admin_audit_logs

階級交易成功後，API 另寫入：

- `action`：`member_tier_adjust`
- `resource_type`：`member_tier`
- `resource_id`：`member_tier_history` id
- `target_user_id` / `target_email`：被調整會員
- `before_data`：`current_tier` / `highest_tier` / `minimum_tier`（調整前）
- `after_data`：`current_tier` / `highest_tier` / `minimum_tier`（調整後）
- `reason`：管理員輸入原因
- `metadata`：`stage`、`manual_adjustment`、`highest_tier_raised`、`points_balance_unchanged`、`lifetime_earned_points_unchanged`、`total_valid_spend_unchanged`

沿用既有 `writeAdminAuditLog` 敏感資料清理（password／token／secret／cookie／authorization／api key／service role 一律不寫入）。Audit 寫入失敗會留下 server-side 簡短錯誤，但不回滾已完成的階級交易；`member_tier_history` 仍是階級異動的權威紀錄。

## RPC 安全

- 函式使用 `security invoker` 與空白 `search_path`。
- 撤銷 `PUBLIC`、`anon`、`authenticated` 執行權限，僅授權 `service_role`。
- 參數在 API（`validateAdminTierAdjustment` + `canActorAssignTier`）與資料庫函式兩層驗證。
- 不暴露 service role key，不接受任意 SQL，不允許前端直接改 `profiles`。

## 部署順序（重要）

1. 先套用 migration `20260721090000_stage13_admin_tier_adjust.sql` 到 Supabase（`supabase db push` 或於 SQL Editor 執行），確認 `admin_adjust_member_tier` RPC 與 `profiles_single_king_idx` 建立成功。
2. 再部署前端。若 RPC 尚未建立，`/api/admin/members/[id]/tier-adjust` 會回 500，但不影響其他頁面與 build。

## Production 測試建議

Production 資料少，避免破壞 owner 狀態。`highest_tier` 只升不降，測試時不要把 owner 升到高階級再恢復。

建議安全流程：`poor → super_poor → poor`，可驗證 `current_tier` 可調整與恢復、`highest_tier` 不降低、`points_balance` / `lifetime_earned_points` / `minimum_tier` 不變、`member_tier_history` 與 `admin_audit_logs` 有紀錄。

若要驗證 `highest_tier` 往上更新，請在本機或可丟棄的測試會員操作，不要為了測試而永久改壞 Production owner 的 `highest_tier`。

## 尚未完成

- `minimum_tier` 手動保底策略
- `lifetime_earned_points` 人工調整策略
- 自動升降級
- 消費滿 NT$2000 自動商人
- 消費與退款點數
- 訂單系統、金流
- 會員資料 CSV 匯出
- 正式網域驗證
