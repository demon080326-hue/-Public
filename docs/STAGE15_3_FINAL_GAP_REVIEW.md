# 第 15-3 階段：第 13～15-2 總驗收與上線前缺口

## 第 15-3 階段目標

本階段只核對第 13、14、15 與 15-2 階段的程式、Production 資料、RLS、權限、稽核紀錄、頁面與響應式結果。沒有修改功能、資料庫結構、正式資料、環境變數、AI collector、商城或訂單流程。

驗收基準：

- Production：`https://public-zeta-pink.vercel.app`
- 分支：`main`
- 第 13 commit：`9acfbc2 feat: add admin tier adjustment`
- 第 14 commit：`96c4397 feat: add product database management`
- 第 14 Production 補強：`b300fa4 fix: complete stage 14 product database rollout`
- 第 15 commit：`41286fe feat: add order system foundation`
- 第 15-2 commit：`c523081 feat: improve ai news content and layout`

## 第 13 階段檢查結果

- `/api/admin/members/[id]/tier-adjust`：存在，使用 `requireAdminAccess`。
- `admin_adjust_member_tier`：Production 存在，以單一 RPC transaction 更新階級。
- RPC 權限：`service_role` 可執行；`authenticated`、`anon` 不可執行。
- King 唯一性：`profiles_single_king_idx` 存在，目前 `king_count = 0`。
- `/admin/members/[id]`：存在手動調整階級 UI。
- `current_tier`：可由 owner/admin 經 server API 安全調整。
- `highest_tier`：RPC 只允許往上更新，不會因降級而降低。
- `minimum_tier`、`points_balance`、`lifetime_earned_points`、`total_valid_spend`：RPC 不更新。
- Royal 權限：admin 不能設定 `royal_relative`、`royal_direct`、`king`；只有 owner 可設定。
- `member_tier_history`：共 3 筆，其中 `manual_adjustment` 2 筆。
- `member_tier_adjust` audit：2 筆。
- 未登入 tier-adjust：Production 回 401。
- 非 owner/admin：程式分支回 403；沒有冒用一般會員 session 實測。

Production 會員資料：

| 帳號角色 | current_tier | highest_tier | minimum_tier | points_balance | lifetime_earned_points | total_valid_spend |
| --- | --- | --- | --- | ---: | ---: | ---: |
| owner | poor | poor | poor | 2 | 2 | 0 |
| member | poor | poor | poor | 0 | 0 | 0 |

第 13 階段未修改 owner/admin role，Production 仍只有一位 owner。

## 第 14 階段檢查結果

- `products`：Production 存在，RLS 已啟用。
- 公開讀取政策：`anon`、`authenticated` 只能讀取 `status = published`。
- 寫入政策：只有 `service_role`；一般 authenticated 沒有 INSERT、UPDATE、DELETE grant。
- 管理頁：`/admin/products`、`/admin/products/new`、`/admin/products/[id]/edit` 均存在。
- 管理 API：`/api/admin/products`、`/api/admin/products/[id]` 均存在。
- `/shop`：讀取 published products；目前商品區顯示安全空狀態。
- `/marketplace`：Production 200，未被破壞。
- Audit：`product_create = 1`、`product_update = 1`、`product_archive = 1`。

Production 商品狀態：

- products 總數：1
- published：0
- draft：0
- archived：1
- `/shop` 資料庫商品顯示數：0

目前唯一商品維持 archived 是安全狀態。Production 現在沒有 published 商品，因此本次只能驗收 published 查詢與安全空狀態，不能用現存資料再次驗收前台商品卡。

本階段沒有購物車、付款、訂單生成或點數折抵。

## 第 15 階段檢查結果

- `orders`、`order_items`、`order_events`：Production 均存在，三張表 RLS 全部啟用。
- 會員 SELECT：只能讀自己的 order；items/events 透過自己的 order 關聯判斷。
- 寫入：只有 `service_role`；authenticated 沒有 INSERT、UPDATE、DELETE grant。
- 一般會員不能將訂單改成 paid。
- 管理頁：`/admin/orders`、`/admin/orders/[id]` 存在。
- 會員頁：`/member/orders`、`/member/orders/[id]` 存在。
- API：管理與會員的列表、詳細 API 均存在。
- 管理員查看有效訂單詳細時，程式會寫入 reason `admin_order_detail_view` 的 audit。

Production 訂單狀態：

- orders：0
- order_items：0
- order_events：0
- paid 訂單：0
- `points_earned > 0`：0
- `points_redeemed > 0`：0
- admin order detail audit：0

目前 0 筆訂單是預期狀態。沒有永久建立測試訂單；詳細頁、RLS 與查詢邏輯只有程式檢查及先前 rollback 測試，尚無真實 Production 訂單可做端到端驗收。

本階段沒有付款、退款、出貨、自動加點、商品解鎖、扣庫存或 checkout。

## 第 15-2 階段檢查結果

Production 資料：

- `ai_news`：61
- 台北時間 2026-07-23：2
- 週報：`6a9fdbd6-8423-4f54-8908-ed68fabe2a4f`
- 週報標題：`AI 情報週報：7/17～7/23 重點整理`
- 有 `image_url`：9
- 重複 URL 群組：0
- 空 title、summary、content、url：0
- 超過一天的未來日期：0
- 明確測試資料：0
- 非 HTTP/HTTPS image URL：0

Production 版面：

- `/news`：200，顯示最新 24 張卡片。
- 1440px：容器 1120px，置中三欄，無水平捲動。
- 390px：單欄，容器寬 347px，左右約 14px，無水平捲動。
- `/news/[id]`：200，桌機閱讀容器 820px 置中。
- 詳細頁包含一句話摘要、重點整理、這篇大概在講什麼、為什麼值得關注、內文整理與原始來源。
- 9 個來源圖片已核對；AIBase 圖片阻擋一般 curl，但三張在 Production 瀏覽器均成功載入。前端仍有 onError 隱藏保護。
- Browser Console：本次巡覽沒有 error。

## 權限檢查

- 未登入 `/admin`、`/dashboard`、管理子頁：導向 `/login?notice=admin-auth-required`。
- 未登入 `/api/admin/members`：401。
- 未登入 `/api/admin/products`：401。
- 未登入 `/api/admin/orders`：401。
- 未登入 points-adjust：401。
- 未登入 tier-adjust：401。
- 未登入 `/api/member/checkin`：401。
- 已登入 owner 可進入 `/member`、`/dashboard`、`/admin`、會員、商品、訂單管理頁。
- owner：1；admin：0；member：1；pending_member：0。
- 沒有新增或變更 owner/admin。
- 非 admin 403 Production session 未實測；程式分支已確認。

## 資料狀態

| 項目 | Production 數量 |
| --- | ---: |
| ai_news | 61 |
| products | 1（archived 1） |
| orders | 0 |
| order_items | 0 |
| order_events | 0 |
| points_balance 合計 | 2 |
| member_points_ledger | 3 |
| member_tier_history | 3 |
| admin_audit_logs | 41 |
| owner | 1 |
| admin | 0 |
| member | 1 |
| pending_member | 0 |

## Production 驗收

- `npm run build`：成功。
- `npm run typecheck`：成功。
- `npm run lint`：0 errors、3 個既有 `<img>` warning。
- `/`、`/login`、`/member`、`/member/orders`：正常。
- `/dashboard`、`/admin`、`/admin/members`、`/admin/products`、`/admin/orders`：owner session 正常，未登入會導回登入頁。
- `/shop`、`/marketplace`、`/news`、週報詳細頁：200。
- Production 已提供第 15-2 置中版面，視為 Ready。

## 高優先缺口

對目前「資訊網站＋會員／商城／訂單唯讀基礎」上線：沒有發現新的高優先安全或資料正確性缺口。

若要對外開放正式商城交易，下列項目仍是明確阻擋條件：

- 尚未實作正式 checkout、付款驗證、付款 webhook。
- 尚未實作退款、出貨、庫存扣減、商品解鎖與點數折抵。
- 在上述功能完成及安全驗收前，不可把商品按鈕改成可付款或建立正式訂單。

## 中優先缺口

- 非 admin 403 尚未用真實一般會員 Production session 端到端實測。
- 沒有 published 商品，前台商品卡與發布後公開顯示目前只有先前測試證據，沒有現存 Production 商品可重驗。
- 沒有真實訂單，admin/member 訂單詳細、訂單事件與 detail audit 尚未做永久 Production 資料驗收。
- 正式訂單生命週期、冪等 webhook、金額快照與失敗補償尚未設計完成；這些必須在任何金流開發前補齊。

## 低優先缺口

- ESLint 仍有 3 個既有 `<img>` 效能 warning，沒有 error。
- AI 圖片依賴外部來源，AIBase 會阻擋非瀏覽器請求；目前瀏覽器正常且有失敗隱藏保護。
- 部分來源標題仍保留英文，繁體中文摘要與閱讀重點正常。
- `getPublishedNews` 前台限制顯示 24 筆；未來資料量增加後可評估分頁或載入更多。

## 是否建議進入第 16

可以進入第 16 的「開發與測試」，因為第 13～15-2 的既有範圍未發現高優先回歸。

不能因此直接開放正式交易。若第 16 涉及金流、付款、checkout、退款、出貨、點數折抵或商品解鎖，必須先完成下列條件並另行安全審查。

## 第 16 前必備條件

1. 使用一般會員 Production session 補做所有 admin 頁面與 API 的 403 驗收。
2. 準備一筆可安全下架的 published 商品，驗收前台顯示後再封存。
3. 如需測試訂單，使用明確測試標記並以 rollback 或安全封存策略驗收，不得污染正式訂單。
4. 先完成訂單狀態機、金額快照、冪等性、付款 webhook 驗證、audit 與失敗補償設計。
5. 正式交易功能必須具備 server-side 權限、RLS、稽核與回歸測試，不得以 localStorage 或前端按鈕解鎖。
