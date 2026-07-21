# 第 14 階段：商城商品資料庫化

## 1. 目標

把商城商品從靜態內容升級成 Supabase 資料庫系統，讓 `owner` / `admin` 能在後台建立、編輯、上架、下架商品，前台 `/shop` 只讀取已發布（published）商品。本階段**只做商品資料庫化與商品管理**，不含訂單、金流、付款、購物車、點數折抵、商品收藏、下載解鎖、優惠券、CSV 匯出。

## 2. products schema

`public.products`

| 欄位 | 型別 | 說明 |
| --- | --- | --- |
| id | uuid PK | `gen_random_uuid()` |
| slug | text unique not null | 前台網址用，格式 `^[a-z0-9]+(?:-[a-z0-9]+)*$`，1-160 |
| name | text not null | 1-200 |
| subtitle | text null | ≤200 |
| description | text null | ≤5000 |
| product_type | text not null | course / digital / physical / service / food / other |
| category | text null | ≤100 |
| price_cents | integer not null default 0 | ≥0，單位「分」（TWD 元 × 100） |
| compare_at_price_cents | integer null | ≥0 |
| currency | text not null default 'TWD' | 固定 TWD |
| image_url | text null | http/https |
| status | text not null default 'draft' | draft / published / archived |
| stock_status | text not null default 'in_stock' | in_stock / out_of_stock / preorder / unlimited |
| inventory_quantity | integer null | ≥0 |
| is_featured | boolean not null default false | |
| sort_order | integer not null default 0 | 越小越前面 |
| metadata | jsonb not null default '{}' | 不對前台公開 |
| created_by / updated_by | uuid null → auth.users | on delete set null |
| created_at / updated_at | timestamptz not null default now() | |

規則：price_cents / compare_at_price_cents / inventory_quantity ≥ 0；slug 唯一；status、product_type、stock_status 白名單；currency 固定 TWD；archived 不做硬刪除。

> `product_categories` 資料表本階段不建立——用 `products.category` 文字欄位即可涵蓋需求。

## 3. RLS 規則

- `products_select_published`：`anon` 與 `authenticated` 只能 `select` `status = 'published'` 的商品。
- `products_service_role_all`：`service_role` 可讀寫全部。
- `grant select` 給 anon / authenticated；`grant all` 給 service_role。
- 一般 member 不能 insert / update / delete；所有寫入只走 server-side API + Supabase admin client。
- 前台讀取用 anon server client（受 RLS 限制），因此 draft / archived 不可能外流到前台。

## 4. Admin API

| Method | Path | 說明 |
| --- | --- | --- |
| GET | `/api/admin/products` | 列表，支援 search（name/slug）、status、product_type、分頁 |
| POST | `/api/admin/products` | 新增商品 → audit `product_create` |
| GET | `/api/admin/products/[id]` | 單筆（含 draft/archived） |
| PATCH | `/api/admin/products/[id]` | 更新 → audit `product_update`；當 status 改為 archived 時 → audit `product_archive` |

- 全部經 `requireAdminAccess()`；未登入 401，非 admin/owner 403。
- 本階段**不做 DELETE 硬刪除**；下架 = `status = 'archived'`。
- 回應只含商品欄位，不回傳 secret / token / cookie / service role。
- slug 重複回 409（`SLUG_TAKEN`）。

## 5. 前台讀取規則

- `/shop` 為 server component，用 `getPublishedProducts()` 讀已發布商品，渲染 `ProductCard` 卡片（名稱、副標、描述、價格、原價劃線、類型、庫存狀態）。
- 只顯示 published；draft / archived 不出現。
- 不做加入購物車、付款、購買解鎖。
- 讀取失敗（例如 migration 尚未套用）時回空陣列，前台顯示「商品即將上架」，不會讓頁面崩潰；既有 `shop.html` 選購清單內容保留在下方。

## 6. audit log

沿用既有 `writeAdminAuditLog` 與 `admin_audit_logs`（未修改 schema 與敏感資料清理）：

- `product_create`：resource_type `product`、resource_id 商品 id、after_data（slug/name/status/price_cents/product_type）。
- `product_update` / `product_archive`：before_data / after_data 摘要 + metadata（changed_fields、archived）。

`admin_audit_logs.action` 只有長度限制、無 enum 白名單，因此新增 `product_archive` 這個 action 值不需修改該表。

## 7. 不做事項

訂單系統、金流、付款、購物車、點數折抵、商品收藏、下載解鎖、優惠券、CSV 匯出、正式網域 / DNS / Resend domain、DELETE 硬刪除。

## 8. 測試方式

1. 未登入呼叫 `/api/admin/products` → 401。
2. 以 owner 登入 `/admin/products` 新增商品（draft），確認列表出現、前台 `/shop` 不出現。
3. 編輯商品把 status 改 published → `/shop` 出現。
4. 編輯商品下架（archive）→ `/shop` 不再出現，資料仍在（未硬刪除）。
5. 送出非法 slug / 負數價格 / 非法 product_type → 400。
6. 重複 slug → 409。
7. 確認 audit log 新增 product_create / product_update / product_archive。
8. 回歸：`/api/member/checkin`、`/api/admin/members`、points-adjust、tier-adjust、`/news`、`/news/[id]` 不受影響。
9. `npm run build`、`npm run typecheck`、`npm run lint`。

## 9. 部署順序

1. 先套用 migration `20260721100000_stage14_products.sql`（`supabase db push` 或 SQL Editor）。
2. 再部署前端。migration 未套用前，`/shop` 顯示空狀態、admin 商品 API 會回 503/500，但不影響其他頁面與 build。

## 10. 下一階段建議

第 15 階段可規劃：商品明細頁（`/shop/[slug]`）、精選商品排序策略，並開始設計訂單資料表與 server-side checkout 的邊界（仍不接金流），為之後的點數折抵與下載解鎖預留欄位。
