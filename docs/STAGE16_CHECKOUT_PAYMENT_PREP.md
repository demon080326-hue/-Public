# 第 16 階段：Checkout / 金流前置設計

## 目標

第 16 階段建立 Checkout 與付款紀錄的安全前置骨架，供未來正式金流接入使用。本階段只允許建立 disabled checkout session 與唯讀管理查詢；不收款、不建立付款連結，也不讓訂單變成 paid。

## 本階段不開放正式付款

- 沒有綠界、Line Pay、信用卡或其他正式 provider。
- `payment_sessions.provider` 與 `payment_sessions.mode` 目前固定為 `disabled`。
- `provider_payment_url` 在 disabled mode 必須為 `null`。
- Checkout 頁只顯示前置測試提示，不顯示付款按鈕、信用卡欄位或 provider 按鈕。
- 本階段不改 `orders.status`、`orders.payment_status` 或 `orders.fulfillment_status`。

## 資料表

### `payment_sessions`

記錄某筆訂單的付款準備 session。金額從 `orders.total_cents` 讀取，使用者從 `orders.user_id` 判定，不信任任何前端傳入的 amount、userId、provider、mode 或 payment status。

- 唯一 `idempotency_key` 避免同一筆 disabled checkout 建立多個 session。
- 狀態完整預留：`created`、`pending`、`authorized`、`paid`、`failed`、`cancelled`、`expired`、`refunded`。
- 第 16 階段實際只會建立 `created`；未來可安全使用 `pending`、`cancelled`、`expired`、`failed`。
- 不包含信用卡號、CVV、金流 Secret 或正式付款 URL。

### `payment_events`

記錄 payment session 的狀態相關事件。本階段只會寫入 `checkout_session_created`，沒有 `paid` 成功事件。

### `payment_webhook_events`

預留未來 webhook 冪等性所需的 `(provider, provider_event_id)` 唯一限制。此表本階段沒有 webhook endpoint、沒有 provider 驗簽，也不會寫入真實付款成功事件。

payload 與 metadata 不得保存 Authorization header、cookie、Secret、信用卡資料或 CVV。

## RLS 與寫入邊界

- 三張 payment 表均啟用 RLS。
- 會員只能讀自己的 `payment_sessions`，以及自己訂單相關的 `payment_events`。
- 會員與未登入者沒有 payment table 的 INSERT、UPDATE、DELETE 權限。
- `payment_webhook_events` 不對會員開放讀取。
- 管理端一律使用現有 server-side admin client；前端不會取得 service role key。

## Checkout API

`POST /api/checkout/create-session`

唯一接受的 request body：

```json
{ "orderId": "uuid" }
```

行為：

1. 必須登入、完成 Email 驗證並具正式會員狀態。
2. 資料庫 transaction 會鎖定訂單並確認 `orders.user_id` 與目前使用者相同。
3. 訂單只接受 `draft` 或 `pending_payment`，且付款狀態只能是 `unpaid` 或 `pending`。
4. 金額由資料庫中的 `orders.total_cents` 讀取。
5. 建立或安全重用 `disabled` session，僅在首次建立時寫入 `payment_events` 與 `order_events` 的 `checkout_session_created`。
6. 回傳 `paymentUrl: null`，不會導向任何付款服務。

重複 request 使用相同 order 的固定 idempotency key，會回傳同一筆 session 且 `created: false`；不重複寫事件、不重複改訂單。

## Checkout 與管理頁

- `/checkout/[orderId]`：會員自己的唯讀付款準備頁，清楚提示不會扣款。
- `/admin/payments`：owner/admin 付款準備列表，可依 session status、provider、mode 篩選。
- `/admin/payments/[id]`：唯讀顯示 payment events 與 webhook event 計數；不提供改 paid、退款、重送 webhook、補點或解鎖按鈕。
- `GET /api/admin/payments` 與 `GET /api/admin/payments/[id]`：未登入回 401，非 owner/admin 回 403。

## 付款狀態機

設計轉換為：

```text
created -> pending -> paid
created -> cancelled
pending -> failed | expired
paid -> refunded
```

第 16 階段不允許正式產生 `paid` 或 `refunded`。未來第 17 階段必須先完成 provider webhook 驗簽與冪等交易，才可以由 verified webhook 處理 `pending -> paid`。

## 為什麼本階段不改 paid、不加點、不解鎖

沒有經驗證的 provider webhook 時，任何 paid transition 都不能信任。若現在改 paid，會造成未付款訂單被誤認為已付款，也可能錯誤增加點數或解鎖商品。因此第 16 只建立資料模型、權限和 disabled session；履約行為全部延後到第 17。

## 未來接入綠界 / Line Pay

使用者本人未來需要完成：

- 建立 provider 商家帳號與取得正式商店資料。
- 設定正式網域、HTTPS webhook URL、provider callback URL。
- 將 provider Secret 僅寫入 Vercel server-side environment variables。
- 在 provider 後台設定 webhook 驗簽與回呼設定。
- 使用 provider sandbox / test mode 驗證後，再啟用 Production live mode。

## 測試方式

1. 執行 `npm run build`、`npm run typecheck`、`npm run lint`。
2. 確認三張表存在、RLS 已啟用、authenticated 沒有寫入權限。
3. 未登入呼叫 `POST /api/checkout/create-session` 應回 401。
4. 重複對同一筆符合資格訂單建立 session，應維持同一 session，且只保留一筆 `checkout_session_created` event。
5. 檢查 `orders`、點數、商品、新聞資料都沒有被更動。

## 尚未完成

- 正式金流 provider、綠界與 Line Pay 串接
- 付款成功 webhook 驗簽
- 訂單改 paid
- 商品解鎖與消費點數入帳
- 庫存扣除、退款、發票、Email 通知
- 正式網域驗證

## 下一階段建議

第 17 階段應只在 verified webhook transaction 中處理 paid order transition、商品 entitlement、消費點數與履約冪等性。
