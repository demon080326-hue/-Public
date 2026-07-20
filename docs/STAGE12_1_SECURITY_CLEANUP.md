# 第 12-1 階段：不用買網域的上線安全收斂

更新日期：2026-07-20

## 範圍

本階段只處理不依賴正式網域的安全修正。沒有購買網域、設定 DNS、設定 Resend 自訂網域，也沒有調整 Supabase Site URL、Redirect URLs、Email template 或 Vercel 環境變數。

## 第 1 項：Netlify bearer token

- 外層 Netlify 靜態站的 lib/auth.js 已停止使用直接字串比較。
- bearer token 與環境變數 token 會先轉為固定長度 SHA-256 digest，再使用 Node.js crypto.timingSafeEqual 比對。
- token 值沒有變更、沒有寫入文件，也不會輸出到 log。
- Next.js 的 /api/ai-news/ingest 完全未修改。

## 第 2 項：admin news Production 權限

- 已移除 app/api/admin/news/route.ts 的 CMS_LOCAL_ONLY Production hard block。
- Production 的 owner / admin 現在可通過原有 requireAdminAccess 後進入 payload 驗證與新增流程。
- 未登入仍由 requireAdminAccess 回傳 401；非 owner / admin、未驗證或需要重新驗證的帳號仍回傳 403。
- 原有欄位驗證、Supabase server client 與 admin_news_create audit log 保持不變。
- 本階段不送出有效新增 payload，因此不改動既有 AI 情報資料。

## 第 3 項：Next.js Proxy 驗證

- proxy.ts 位於實際 Next.js repository root，匯出 proxy(request) 與 config.matcher。
- matcher 排除靜態資源與 API，頁面請求交由 lib/supabase/middleware.ts 更新 Supabase session。
- /dashboard、/admin 與子路由仍由 proxy 對未登入請求導向 /login?notice=admin-auth-required。
- next build 的輸出包含 Proxy (Middleware)，表示 Next.js 已辨識並編譯此檔案；Production 再以未登入導向與 owner session 存取驗證。
- 本階段未調整 middleware / proxy 架構。

## 第 11 項：GitHub Actions workflow 清理

目前真正的 Git repository root 是 next-app/，不是其外層 james-site/。因此：

- 保留並且完全不修改 next-app/.github/workflows/ai-news-collector.yml；它就是 GitHub repository root 的正式 workflow。
- 移除外層 james-site/.github/workflows/ai-news-collector.yml 舊副本。該副本不受目前 Git repository 追蹤，且仍使用舊的 working-directory: next-app 設定。
- 正式 workflow 的排程、Node.js 版本、Secrets 與收集流程均未變更。

## 第 27 項：Netlify publish 防護

- 外層 Netlify 靜態站新增 .netlifyignore。
- 排除 next-app/、supabase/、scripts/、.github/、docs/、.env*、node_modules/、.git/、.next/ 與 log。
- 根目錄既有 HTML、CSS、JavaScript、圖片、data/ 與 netlify/functions/ 沒有排除，避免破壞靜態站必要檔案。
- Vercel 使用的 next-app repository、設定及部署流程未修改。

注意：外層 james-site/ 目前不是 Git repository，.netlifyignore 與 Netlify lib/auth.js 的修改屬於本機外層靜態站設定，不會包含在 next-app 的 Git commit。若外層 Netlify 站是由另一個 repository 或手動 CLI 部署，部署時需確認該來源包含這兩項修改；不得為此把整個外層目錄強行加入 next-app repository。

## 驗收原則

- 不建立 AI 情報測試資料。
- owner session 可用無效 payload 驗證 API 已越過 Production hard block，預期回傳 400 validation error；不得回傳 CMS_LOCAL_ONLY。
- 未登入 POST /api/admin/news 預期 401。
- 非 admin / owner 預期 403；沒有測試會員 session 時，以既有 requireAdminAccess 分支與自動測試確認，不擅自調整角色。
- /api/member/checkin、會員點數規則、AI 情報 ingest、RSS collector 與資料庫均不修改。

## 保留不動

- APP_PUBLIC_URL 正式網域切換
- Resend 正式寄件網域與 SMTP
- Supabase Site URL、Redirect URLs 與 Email template 正式網域
- DNS、網域購買與第 7 階段 B-4
