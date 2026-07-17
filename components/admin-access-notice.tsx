"use client";

import Link from "next/link";
import { useSiteLanguage } from "@/hooks/use-site-language";
import { translateSiteText } from "@/lib/site-language";

type AdminAccessNoticeProps = {
  page: "dashboard" | "news";
};

export function AdminAccessNotice({ page }: AdminAccessNoticeProps) {
  const language = useSiteLanguage();
  const t = (text: string) => translateSiteText(text, language);
  const title = page === "news" ? "AI 情報管理為管理員專用" : "管理後台為管理員專用";

  return (
    <section className="access-notice-section">
      <div className="wrap access-notice">
        <span className="tag">ADMIN ONLY</span>
        <h1>{t(title)}</h1>
        <p>{t("目前尚未啟用正式管理員帳號與角色驗證。為避免一般會員取得 CMS、AI 情報新增、編輯或刪除權限，這個入口目前只顯示安全提示。")}</p>
        <p className="access-notice-subtle">{t("一般會員可以使用 AI 情報、工具、文章與會員點數 MVP；管理功能將在正式登入與角色權限完成後開放。")}</p>
        <div className="access-notice-actions">
          <Link className="btn" href="/news">{t("查看 AI 情報")}</Link>
          <Link className="btn secondary" href="/login">{t("前往會員中心")}</Link>
        </div>
      </div>
    </section>
  );
}
