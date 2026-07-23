# 第 15 階段：訂單系統基礎

## 1. 階段目標

建立唯讀訂單資料與查詢基礎，供未來 checkout、金流、付款結果、商品解鎖與消費點數功能使用。

本階段沒有正式購買流程，也不提供付款、退款、出貨、發票、點數、庫存或商品解鎖操作。

## 2. `orders` schema

`public.orders` 保存訂單層級資料：

- UUID 主鍵與唯一 `order_number`
- 可為空的 `user_id` 與 `buyer_email`
- 訂單、付款及履行三組獨立狀態
- TWD 金額快照
- 預留點數欄位，但本階段固定不自動異動
- 預留付款 provider/reference、備註與 metadata
- `created_at`、`updated_at`

所有狀態、金額、長度與 metadata 大小均有資料庫約束。

## 3. `order_items` schema

`public.order_items` 保存商品快照：

- 關聯訂單，訂單刪除時才會 cascade
- 商品外鍵可為空，商品下架或移除不破壞歷史訂單
- 保存商品名稱、slug、數量與成交單價
- `total_cents` 必須等於單價乘以數量

本階段不扣庫存。

## 4. `order_events` schema

`public.order_events` 保存訂單事件：

- 關聯訂單
- 可選的操作人
- 事件類型、前後資料、原因與 metadata
- 建立時間

會員 API 只回傳安全欄位，不回傳 actor、before/after data 或 metadata。

## 5. RLS

三張表均開啟 RLS：

- 未登入者沒有訂單權限。
- authenticated 只能讀取 `auth.uid() = orders.user_id` 的訂單。
- `order_items` 與 `order_events` 透過所屬訂單確認會員身分。
- 一般會員沒有 INSERT、UPDATE、DELETE 權限。
- owner/admin 由 server-only admin client 查詢全部。
- Secret/service role 不會送到瀏覽器。

authenticated 僅取得會員頁需要的欄位級 SELECT 權限。

## 6. Admin 訂單查詢

- `/admin/orders`：依訂單編號、Email、訂單狀態及付款狀態查詢。
- `/admin/orders/[id]`：查看訂單基本資料、項目與事件。
- `GET /api/admin/orders`
- `GET /api/admin/orders/[id]`

未登入回 401，非 owner/admin 回 403。

查看管理端訂單詳細會以 `manual_admin_action`、`order`、`admin_order_detail_view` 寫入 audit log。

## 7. Member 訂單查詢

- `/member/orders`：只顯示目前登入會員自己的訂單。
- `/member/orders/[id]`：只顯示目前會員自己的訂單詳細。
- `GET /api/member/orders`
- `GET /api/member/orders/[id]`

未登入回 401。未完成 Email 驗證或仍是 `pending_member` 時回 403。查詢不存在或其他會員訂單時一律回 404，避免洩漏訂單是否存在。

## 8. 本階段不做付款

- 不建立 checkout。
- 不呼叫金流。
- 不提供付款按鈕。
- 不允許會員變更 `status` 或 `payment_status`。

## 9. 本階段不做點數入帳

- `points_earned` 與 `points_redeemed` 只是預留欄位。
- 不寫入 `member_points_ledger`。
- 不修改 `points_balance` 或 `lifetime_earned_points`。

## 10. 本階段不做商品解鎖

- 不建立 entitlement。
- 不修改下載權限。
- 未付款訂單不會解鎖商品。
- 不修改 `products` 狀態或庫存。

## 11. 測試方式

```powershell
npm run build
npm run typecheck
npm run lint
```

API 驗收：

- 未登入 `GET /api/admin/orders` 應回 401。
- 一般會員 `GET /api/admin/orders` 應回 403。
- 未登入 `GET /api/member/orders` 應回 401。
- 會員只能取得自己的訂單。
- 管理與會員頁面均不應出現付款、退款或出貨按鈕。

## 12. 下一階段建議

未來正式 checkout 應另開階段設計，先完成金流供應商、付款 webhook 冪等性、訂單狀態轉移、失敗補償及 entitlement 安全規則，再開放購買 UI。

## 13. Production 套用狀態

- `stage15_order_foundation` migration 已套用 Production Supabase。
- `orders`、`order_items`、`order_events` 均已建立並啟用 RLS。
- authenticated 沒有 INSERT、UPDATE、DELETE 權限。
- 已使用交易內暫存訂單實測 RLS：會員只能看到自己的訂單、項目與事件。
- RLS 測試完成後已 rollback，Production 三張訂單表維持 0 筆，沒有刪除或留下測試資料。
- Database advisor 未回報 Stage 15 缺少 RLS 或未索引外鍵。
- `products`、會員點數、會員階級、AI 情報與管理角色均未異動。
