# 第 12 階段：Admin 手動調整點數

## 目標

讓 `owner` 與 `admin` 能在會員詳細頁安全調整會員的可用點數，並保留不可刪除的點數 ledger 與後台 audit log。本階段不處理階級、訂單、金流或商品。

## 新增 API

- `POST /api/admin/members/[id]/points-adjust`
- Request：`type`（`add` 或 `deduct`）、`points`（1-10000 正整數）、`reason`（5-300 字）。
- 未登入回 401，非管理員回 403，會員不存在回 404，輸入錯誤或扣成負數回 400。
- 回應只包含會員 ID 與調整前後點數，不回傳憑證、token、cookie 或其他敏感欄位。

## 新增 UI

`/admin/members/[id]` 新增「手動調整點數」區塊，顯示目前點數、預估調整後點數、加點／扣點、原因與安全提醒。送出中會停用表單，成功後清空欄位並重新整理資料。

## 權限規則

- 頁面及 API 都沿用既有 `requireAdminAccess()`。
- 一般 `member`、`pending_member` 與未登入訪客不可使用。
- 前端不直接更新 Supabase；所有寫入只在 server-side API 與 service-role-only RPC 執行。

## 點數調整規則

- 加點只增加 `points_balance`。
- 扣點只減少 `points_balance`，且餘額不得小於 0。
- `points` 僅接受 1-10000 的正整數。
- `reason` 去除前後空白後必須為 5-300 字。
- 不修改 `total_valid_spend`、簽到規則或重複簽到規則。

## 為什麼不修改 lifetime_earned_points

`lifetime_earned_points` 代表歷史累積獲得點數。第 12 階段只調整目前可使用的點數，因此手動加點或扣點都不改歷史累積值，避免行政補償或修正誤觸會員成長規則。

既有 profile 同步函式原本會把 `lifetime_earned_points` 強制提高到至少等於可用餘額；這會讓管理員手動加點間接改變歷史累積點數。本階段移除該衍生行為，但保留 Email 驗證、角色與初始階級同步，其餘正式點數來源仍自行明確更新 lifetime。

## 為什麼不自動調整階級

會員階級可能同時依賴歷史點數、消費與人工規則。第 12 階段不修改 `current_tier`、`highest_tier`、`minimum_tier`，階級調整留待後續階段制定獨立規則與稽核流程。

## member_points_ledger

資料庫函式 `admin_adjust_member_points` 會在同一個 PostgreSQL transaction 內鎖定會員 profile、更新 `points_balance`，並新增一筆：

- `source_type`: `admin_adjustment`
- `amount`: 加點為正數，扣點為負數
- `balance_after`: 調整後餘額
- `lifetime_earned_after`: 維持調整前值
- `note`: 管理員填寫的原因
- `metadata`: 操作者 ID／Email、操作類型、前後點數與階段名稱

若 update 或 ledger insert 任一步失敗，整個函式交易會回滾，不留下半套資料。

## admin_audit_logs

點數交易成功後，API 另寫入：

- `action`: `member_points_adjust`
- `resource_type`: `member_points`
- `resource_id`: ledger ID
- `before_data` / `after_data`: 調整前後餘額與 delta
- `reason`: 管理員輸入原因
- `metadata`: 操作類型、點數、ledger ID 與階段名稱

Audit 寫入失敗會留下 server-side 簡短錯誤，但不會回滾已完成的點數交易；ledger 仍是點數異動的權威紀錄。

## RPC 安全

- 函式使用 `security invoker` 與空白 `search_path`。
- 明確撤銷 `PUBLIC`、`anon`、`authenticated` 執行權限。
- 僅授權 `service_role`，且只由 server-side admin client 呼叫。
- 參數在 API 與資料庫函式兩層驗證。

## 錯誤處理

- 無效 JSON、操作類型、點數與原因：400
- 扣點後低於 0：400
- 會員不存在：404
- 未登入：401
- 非 admin / owner：403
- Server 或資料庫錯誤：500，回應不包含 SQL、Secret 或憑證

## 測試方式

1. 以 owner 登入 `/admin/members/[id]`。
2. 測試加點並確認 profile、ledger、audit log。
3. 測試扣回原餘額，確認 lifetime 與三個 tier 欄位未改變。
4. 測試原因少於 5 字、0、負數、小數與大於 10000。
5. 測試扣成負數會被阻擋。
6. 未登入呼叫 API 應回 401；一般會員應回 403。
7. 執行 `npm run build`、`npm run typecheck`、`npm run lint`。

## 尚未完成

- `lifetime_earned_points` 調整策略
- Admin 調整階級
- 自動升降級
- 消費點數入帳
- 退款扣點
- 訂單系統
- 金流
- CSV 匯出

## 下一階段建議

第 13 階段先定義人工調整階級與 `lifetime_earned_points` 的獨立規則、二次確認與 audit 格式，再決定是否開放後台操作。
