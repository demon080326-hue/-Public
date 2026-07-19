# 第 9 階段：會員點數資料庫化 + 會員階級制度基礎

本階段目標是把會員中心原本的 localStorage 點數 MVP，升級為 Supabase 資料庫紀錄，並建立會員階級制度的基礎資料結構。

## 本階段完成範圍

- 會員點數資料庫化。
- `profiles.points_balance` 作為可使用點數。
- `profiles.lifetime_earned_points` 作為歷史累積獲得點數。
- 每日簽到：每天一次，成功後 +2 點。
- 連續簽到 7 天：基礎判定成立時額外 +5 點。
- `member_points_ledger` 作為點數帳本。
- 會員階級資料庫基礎。
- `current_tier`、`highest_tier`、`minimum_tier`。
- `total_valid_spend` 欄位預留給未來正式金流或管理員流程。
- `member_tier_settings`。
- `member_tier_history`。
- `/member` 顯示階級、點數、簽到狀態與最新 ledger。

## 會員階級

階級使用穩定 key，避免直接用中文作為程式判斷。

| tier_key | 顯示名稱 | sort_order | 自動升級條件 |
| --- | --- | ---: | --- |
| `super_poor` | 超級窮 | 10 | 未驗證、待驗證、受限狀態 |
| `poor` | 貧民 | 20 | 已驗證且為正式會員 |
| `commoner` | 平民 | 30 | 有效消費累積 >= 500 |
| `merchant` | 商人 | 40 | 有效消費累積 >= 2,000 |
| `noble` | 貴族 | 50 | 歷史累積獲得點數 >= 5,000 |
| `royal_citizen` | 皇民 | 60 | 歷史累積獲得點數 >= 7,000 |
| `royal_relative` | 皇親 | 70 | manual-only |
| `royal_direct` | 皇族 | 80 | manual-only |
| `king` | 國王 | 90 | manual-only |

`royal_relative`、`royal_direct`、`king` 本階段只保留資料結構，不提供自動升級與管理 UI。

## 點數規則

- `points_balance`：可使用點數。
- `lifetime_earned_points`：歷史累積獲得點數，用於階級升級。
- 階級升級以 `lifetime_earned_points` 與 `total_valid_spend` 判斷，不以 `points_balance` 判斷。
- 每日簽到 +2 點。
- 同一台北日期只能簽到一次。
- 連續 7 天簽到，基礎判定成功時額外 +5 點。
- 整月簽到 +10 與整年簽到 +100 只列為未來規劃，本階段不開放。

## Ledger

`member_points_ledger` 是 append-only 點數帳本。

本階段可實際使用的 `source_type`：

- `daily_checkin`
- `streak_bonus_7_days`

以下 `source_type` 只預留，尚未開放：

- `monthly_full_checkin_bonus`
- `yearly_full_checkin_bonus`
- `purchase_reward`
- `admin_adjustment`
- `redemption`
- `refund_reversal`
- `migration`

Ledger 必須保存：

- `amount`
- `balance_after`
- `lifetime_earned_after`
- `source_type`
- `note`
- `checkin_date`
- `created_at`

會員不得直接更新 `points_balance`、`lifetime_earned_points`、`current_tier` 或 `total_valid_spend`。本階段每日簽到走 `/api/member/checkin`，由 server-only service role 呼叫資料庫函式 `claim_member_daily_checkin`。

## 階級保護

- `merchant` 是消費保護階級：未來當 `total_valid_spend >= 2000` 時，`minimum_tier = merchant`。
- 未達 2,000 有效消費時，正式會員最低階級為 `poor`。
- `super_poor` 用於 pending、未驗證或特殊受限狀態。
- 未來 inactivity downgrade 僅保留 helper 與文件規劃，本階段不建立 cron job。

## /member 顯示

會員中心顯示：

- 目前階級。
- 最高到達階級。
- 最低保護階級。
- 可使用點數。
- 歷史累積獲得點數。
- 有效消費累積。
- 最近有效購買時間。
- 每日簽到狀態。
- 每日簽到 +2 按鈕。
- 連續 7 天簽到進度。
- 最新點數紀錄。
- 未來功能暫未開放區。

## 明確不做的功能

以下功能雖然可能屬於「平民」階級未來可以解鎖的能力，但第 9 階段全部不實作。

| 功能 | 第 9 階段狀態 |
| --- | --- |
| 商品收藏 | ⬜ 尚未開放，後續階段再做。 |
| 訂單紀錄 | ⬜ 尚未開放，後續階段再做。 |
| 點數折抵 | ⬜ 尚未開放，後續階段再做。 |
| 平民專屬活動 | ⬜ 尚未開放，後續階段再做。 |

限制：

- 不建立商品收藏資料表。
- 不建立訂單資料表。
- 不建立點數折抵功能。
- 不建立活動報名或活動管理功能。
- 不建立相關 API。
- 不建立後台管理 UI。
- 不假造訂單紀錄。
- 不讓會員真的收藏商品。
- 不讓會員真的用點數折抵。

## 安全要求

- `member_points_ledger`、`member_tier_history` 啟用 RLS。
- 會員只能讀取自己的 ledger 與階級歷史。
- 階級設定只允許已登入會員讀取啟用中的項目。
- 寫入與加點由 server-only API 控制。
- `claim_member_daily_checkin` 只授權給 `service_role`。
- 前端不暴露 service role key。
- 不修改 AI 情報自動化流程。
- 不修改 GitHub Actions。
- 不修改 Supabase Secret。
- 不修改既有 `ai_news` schema 或資料。

## 驗收項目

- `/member` 顯示目前階級。
- `/member` 顯示可使用點數。
- `/member` 顯示歷史累積獲得點數。
- `/member` 顯示最高到達階級。
- `/member` 顯示最低保護階級。
- 每日簽到成功 +2。
- 同一天不能重複領取 +2。
- 7 天連續簽到基礎判定與 +5 ledger source 已保留。
- Ledger 包含 `balance_after`。
- Ledger 包含 `lifetime_earned_after`。
- `pending_member` 不能簽到升級。
- 會員不能直接修改 `points_balance`。
- 會員不能直接修改 `lifetime_earned_points`。
- 會員不能直接修改 `current_tier`。
- `member_tier_settings` 已建立。
- `ai_news` 不受影響。
- `demon080326@gmail.com` 仍為唯一 owner / 管理者。

## 尚未完成

- 正式付款 webhook。
- 正式購買回饋。
- 正式訂單紀錄。
- 商品收藏。
- 點數折抵。
- 活動報名。
- 管理員點數調整 UI。
- 管理員階級調整 UI。
- 皇親、皇族、國王手動授權 UI。
- inactivity downgrade cron job。
