# 第 10 階段：管理操作稽核紀錄

## 目標

本階段建立 append-only 的管理操作紀錄，讓 owner / admin 執行高風險操作時留下可追查的伺服器端紀錄。此功能不改動會員角色、點數規則、AI 情報自動收集或既有資料。

## 資料表

`public.admin_audit_logs` 儲存操作者、目標、操作類型、資源、經過清理的 before / after data、原因、IP hash、user agent、安全 metadata 與建立時間。

資料表開啟 RLS。未登入、`pending_member` 與 `member` 不可讀取；`admin` 與 `owner` 可讀取。一般登入使用者沒有 insert、update、delete 權限，server secret client 只有 select 與 insert 權限，因此紀錄不可由前端修改或刪除。

## Server helper

`lib/admin-audit-log.ts` 提供：

- `writeAdminAuditLog()`：由 server-only 管理流程追加紀錄
- `getAdminAuditLogs()`：供已通過管理員驗證的 server component 讀取安全摘要
- `sanitizeAuditMetadata()`：遞迴移除密碼、token、cookie、authorization、API key、Secret、SMTP 與 Resend 等敏感欄位
- `hashIpIfAvailable()`：只保存請求 IP 的 SHA-256 hash，不保存原始 IP

metadata、before / after data 皆有限制深度、項目數、字串長度與總大小，避免意外寫入過量資料。

## 已接入操作

本階段只接入 `app/api/admin/news/route.ts`：AI 情報新增成功後追加 `admin_news_create`，resource type 為 `ai_news`，且只記錄 id、title、category、url、published_at、created_at。新增失敗時不寫稽核紀錄；稽核寫入失敗不回滾已完成的新增。

`/api/ai-news/ingest` 與 GitHub Actions collector 不屬於互動式後台操作，本階段完全不修改。

## 後台顯示

`/admin` 與 `/dashboard` 在既有權限檢查通過後，顯示最近 5 筆安全摘要。完整 metadata、before / after data 不會顯示在前端。

## 保留給後續階段

後續可加入新聞更新/刪除、會員點數、會員階級、商品、訂單、設定與登入安全等 action。本階段不實作點數調整、階級調整、商品、訂單或設定管理。

## 驗收重點

- RLS 開啟
- 未登入、pending_member、member 不可讀取
- admin / owner 可讀取
- 前端與一般 authenticated client 不可新增、修改或刪除
- server helper 可追加安全紀錄
- AI 情報、點數 ledger 與 owner 角色不受影響
