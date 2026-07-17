"use client";

import Link from "next/link";
import { useSiteLanguage } from "@/hooks/use-site-language";
import type { SiteLanguage } from "@/lib/site-language";
import type { MemberRole } from "@/types/database";

type AdminAccessNoticeProps = {
  page: "dashboard" | "news";
  role: MemberRole | null;
  accessGranted: boolean;
};

const copy = {
  "zh-Hant": {
    deniedTitle: "管理後台為管理員專用",
    deniedNewsTitle: "AI 情報管理為管理員專用",
    deniedBody: "管理員專用，目前你的帳號沒有後台權限。一般會員與待驗證會員不能新增、編輯或刪除內容。",
    grantedTitle: "管理員後台骨架",
    grantedNewsTitle: "AI 情報管理骨架",
    grantedBody: "你的資料庫角色已通過管理員檢查。目前只開放安全的後台骨架，完整 CMS 操作仍未啟用。",
    role: "目前角色",
    news: "查看 AI 情報",
    member: "返回會員中心",
  },
  en: {
    deniedTitle: "Admin dashboard restricted",
    deniedNewsTitle: "AI news management restricted",
    deniedBody: "Your account does not have admin access. Members and pending members cannot create, edit, or delete content.",
    grantedTitle: "Admin dashboard foundation",
    grantedNewsTitle: "AI news admin foundation",
    grantedBody: "Your database role passed the administrator check. Only the safe dashboard foundation is available; full CMS actions remain disabled.",
    role: "Current role",
    news: "View AI News",
    member: "Back to Member Center",
  },
  ja: {
    deniedTitle: "管理画面は管理者専用です",
    deniedNewsTitle: "AI情報管理は管理者専用です",
    deniedBody: "このアカウントには管理権限がありません。会員と確認待ち会員はコンテンツを追加・編集・削除できません。",
    grantedTitle: "管理画面の基盤",
    grantedNewsTitle: "AI情報管理の基盤",
    grantedBody: "データベースの管理者権限を確認しました。現在は安全な管理画面の基盤のみで、CMS操作は未実装です。",
    role: "現在の権限",
    news: "AI情報を見る",
    member: "会員センターへ戻る",
  },
} satisfies Record<SiteLanguage, Record<string, string>>;

export function AdminAccessNotice({ page, role, accessGranted }: AdminAccessNoticeProps) {
  const language = useSiteLanguage();
  const text = copy[language];
  const title = accessGranted
    ? page === "news" ? text.grantedNewsTitle : text.grantedTitle
    : page === "news" ? text.deniedNewsTitle : text.deniedTitle;

  return (
    <section className="access-notice-section">
      <div className="wrap access-notice">
        <span className="tag">{accessGranted ? "ADMIN ROLE VERIFIED" : "ADMIN ONLY"}</span>
        <h1>{title}</h1>
        <p>{accessGranted ? text.grantedBody : text.deniedBody}</p>
        <p className="access-notice-subtle">{text.role}：<strong>{role ?? "pending_member"}</strong></p>
        <div className="access-notice-actions">
          <Link className="btn" href="/news">{text.news}</Link>
          <Link className="btn secondary" href="/member">{text.member}</Link>
        </div>
      </div>
    </section>
  );
}
