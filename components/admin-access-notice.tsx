"use client";

import Link from "next/link";
import { useSiteLanguage } from "@/hooks/use-site-language";
import type { SiteLanguage } from "@/lib/site-language";
import type { AdminAccessState, AdminAccessStatus } from "@/lib/admin-access";

type AdminAccessNoticeProps = {
  page: "dashboard" | "news";
  state: AdminAccessState;
};

type NoticeCopy = {
  eyebrow: string;
  role: string;
  actions: {
    login: string;
    member: string;
    news: string;
  };
  pageTitle: Record<AdminAccessNoticeProps["page"], string>;
  status: Record<AdminAccessStatus, { title: string; body: string }>;
};

const copy = {
  "zh-Hant": {
    eyebrow: "ADMIN ONLY",
    role: "目前角色",
    actions: {
      login: "前往登入",
      member: "返回會員中心",
      news: "查看 AI 情報",
    },
    pageTitle: {
      dashboard: "管理後台",
      news: "AI 情報新增",
    },
    status: {
      unauthenticated: {
        title: "請先登入管理員帳號",
        body: "這個頁面僅限 admin / owner 使用。未登入使用者會被導回登入頁。",
      },
      profile_missing: {
        title: "找不到會員 Profile",
        body: "系統尚未建立你的會員資料，請先回會員中心完成帳號狀態同步。",
      },
      email_unverified: {
        title: "Email 尚未驗證",
        body: "管理後台需要已驗證 Email。請先完成信箱驗證後再回來。",
      },
      reverification_required: {
        title: "需要重新驗證",
        body: "為了保護後台安全，請先完成 Email 6 位數重新驗證。",
      },
      forbidden: {
        title: "管理員專用，無法進入",
        body: "一般會員與待驗證會員不能新增、編輯或刪除後台內容。",
      },
      allowed: {
        title: "管理員權限已通過",
        body: "你的帳號已通過 server-side admin / owner 權限檢查。",
      },
    },
  },
  en: {
    eyebrow: "ADMIN ONLY",
    role: "Current role",
    actions: {
      login: "Go to Login",
      member: "Back to Member Center",
      news: "View AI News",
    },
    pageTitle: {
      dashboard: "Admin Dashboard",
      news: "AI News Creation",
    },
    status: {
      unauthenticated: {
        title: "Sign in with an admin account",
        body: "This page is restricted to admin / owner accounts. Signed-out users are redirected to login.",
      },
      profile_missing: {
        title: "Member profile not found",
        body: "Your profile is not ready yet. Please return to the member center and sync your account state.",
      },
      email_unverified: {
        title: "Email is not verified",
        body: "Admin access requires a verified email address. Please complete email verification first.",
      },
      reverification_required: {
        title: "Reverification required",
        body: "For admin safety, please complete the 6-digit email reverification before continuing.",
      },
      forbidden: {
        title: "Admin access only",
        body: "Members and pending members cannot create, edit, or delete admin content.",
      },
      allowed: {
        title: "Admin access verified",
        body: "Your account passed the server-side admin / owner access check.",
      },
    },
  },
  ja: {
    eyebrow: "ADMIN ONLY",
    role: "現在の権限",
    actions: {
      login: "ログインへ",
      member: "会員センターへ戻る",
      news: "AI ニュースを見る",
    },
    pageTitle: {
      dashboard: "管理ダッシュボード",
      news: "AI ニュース追加",
    },
    status: {
      unauthenticated: {
        title: "管理者アカウントでログインしてください",
        body: "このページは admin / owner 限定です。未ログインの場合はログインページへ移動します。",
      },
      profile_missing: {
        title: "会員プロフィールが見つかりません",
        body: "会員データがまだ準備できていません。会員センターでアカウント状態を同期してください。",
      },
      email_unverified: {
        title: "Email が未確認です",
        body: "管理画面を使うには Email 確認が必要です。先に信箱確認を完了してください。",
      },
      reverification_required: {
        title: "再確認が必要です",
        body: "管理画面を保護するため、6 桁の Email 再確認を完了してください。",
      },
      forbidden: {
        title: "管理者専用です",
        body: "一般会員と確認待ち会員は、管理コンテンツの追加・編集・削除を行えません。",
      },
      allowed: {
        title: "管理者権限を確認しました",
        body: "server-side の admin / owner 権限チェックに通過しました。",
      },
    },
  },
} satisfies Record<SiteLanguage, NoticeCopy>;

export function AdminAccessNotice({ page, state }: AdminAccessNoticeProps) {
  const language = useSiteLanguage();
  const text = copy[language];
  const notice = text.status[state.status];
  const role = state.role ?? "visitor";

  return (
    <section className="access-notice-section">
      <div className="wrap access-notice">
        <span className="tag">{text.eyebrow}</span>
        <p className="eyebrow">{text.pageTitle[page]}</p>
        <h1>{notice.title}</h1>
        <p>{notice.body}</p>
        <p className="access-notice-subtle">
          {text.role}: <strong>{role}</strong>
        </p>
        <div className="access-notice-actions">
          {state.status === "unauthenticated" ? <Link className="btn" href="/login?notice=admin-auth-required">{text.actions.login}</Link> : null}
          <Link className="btn secondary" href="/member">{text.actions.member}</Link>
          <Link className="btn secondary" href="/news">{text.actions.news}</Link>
        </div>
      </div>
    </section>
  );
}
