"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { MemberHub } from "@/components/member-hub";
import { useSiteLanguage } from "@/hooks/use-site-language";
import type { AuthUserSummary } from "@/lib/auth-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { SiteLanguage } from "@/lib/site-language";

type AuthMode = "login" | "register" | "forgot";

type MemberAuthHubProps = {
  initialUser: AuthUserSummary | null;
  initialNotice?: "admin-auth-required" | "auth_callback_failed" | "auth-unavailable" | null;
  showPoints?: boolean;
};

const copy = {
  "zh-Hant": {
    eyebrow: "SUPABASE AUTH",
    title: "會員登入",
    description: "使用 Email 與密碼登入。新會員必須完成信箱確認，正式權限才會啟用。",
    login: "登入",
    register: "註冊帳號",
    forgot: "忘記密碼",
    email: "Email",
    password: "密碼",
    confirmPassword: "確認密碼",
    signIn: "登入會員",
    createAccount: "建立帳號",
    sendReset: "寄送重設密碼通知",
    signOut: "登出",
    currentUser: "目前登入帳號",
    authConnected: "會員狀態：正式 Supabase Auth 已連線",
    verified: "Email 已確認",
    pending: "Email 待確認",
    verifyHint: "註冊後請到信箱完成確認；未確認前不會取得正式會員或管理權限。",
    registerHint: "密碼至少 12 個字元。系統會由 Supabase Auth 寄出確認信。",
    forgotHint: "輸入 Email 後，若帳號存在，系統會寄出重設密碼通知。",
    resetGeneric: "如果這個 Email 已註冊，我們會寄出重設密碼通知。",
    signupSent: "驗證信已寄出，請到信箱完成驗證後再登入。",
    passwordMismatch: "兩次輸入的密碼不一致，請重新確認。",
    passwordLength: "密碼至少需要 12 個字元。",
    loginError: "帳號或密碼錯誤，請確認後再試。",
    signupError: "目前無法建立帳號，請稍後再試。",
    unavailable: "登入服務目前無法使用，請稍後再試。",
    invalidLink: "登入或驗證連結無效或已過期，請重新申請。",
    adminRequired: "請先登入。管理頁面仍須管理員角色，普通會員不會取得後台操作權限。",
    signingIn: "登入中...",
    submitting: "處理中...",
  },
  en: {
    eyebrow: "SUPABASE AUTH",
    title: "Member Login",
    description: "Sign in with email and password. New members must confirm their email before access is activated.",
    login: "Sign in",
    register: "Create account",
    forgot: "Forgot password",
    email: "Email",
    password: "Password",
    confirmPassword: "Confirm password",
    signIn: "Sign in",
    createAccount: "Create account",
    sendReset: "Send password reset",
    signOut: "Sign out",
    currentUser: "Signed-in account",
    authConnected: "Member status: Supabase Auth connected",
    verified: "Email confirmed",
    pending: "Email confirmation pending",
    verifyHint: "Confirm your email after registration. Unverified accounts receive no member or admin access.",
    registerHint: "Use at least 12 characters. Supabase Auth will send the confirmation email.",
    forgotHint: "Enter your email. If the account exists, a password reset notice will be sent.",
    resetGeneric: "If this email is registered, we will send password reset instructions.",
    signupSent: "Registration submitted. Confirm your email before signing in.",
    passwordMismatch: "The passwords do not match.",
    passwordLength: "Use at least 12 characters.",
    loginError: "The email or password is incorrect. Please try again.",
    signupError: "We cannot create the account right now. Please try again later.",
    unavailable: "The sign-in service is unavailable. Please try again later.",
    invalidLink: "This sign-in or verification link is invalid or expired.",
    adminRequired: "Please sign in first. Admin pages still require an administrator role.",
    signingIn: "Signing in...",
    submitting: "Working...",
  },
  ja: {
    eyebrow: "SUPABASE AUTH",
    title: "会員ログイン",
    description: "メールアドレスとパスワードでログインします。新規会員はメール確認が必要です。",
    login: "ログイン",
    register: "アカウント登録",
    forgot: "パスワードを忘れた場合",
    email: "メールアドレス",
    password: "パスワード",
    confirmPassword: "パスワードを確認",
    signIn: "ログイン",
    createAccount: "アカウントを作成",
    sendReset: "再設定メールを送信",
    signOut: "ログアウト",
    currentUser: "ログイン中のアカウント",
    authConnected: "会員状態：Supabase Auth 接続済み",
    verified: "メール確認済み",
    pending: "メール確認待ち",
    verifyHint: "登録後にメール確認を完了してください。未確認のアカウントには正式な権限は付与されません。",
    registerHint: "12文字以上で設定してください。確認メールは Supabase Auth から送信されます。",
    forgotHint: "メールを入力してください。登録済みの場合は再設定案内が送信されます。",
    resetGeneric: "登録済みのメールの場合、パスワード再設定の案内を送信します。",
    signupSent: "登録を受け付けました。メール確認後にログインしてください。",
    passwordMismatch: "パスワードが一致しません。",
    passwordLength: "パスワードは12文字以上必要です。",
    loginError: "メールアドレスまたはパスワードが正しくありません。",
    signupError: "現在アカウントを作成できません。後でもう一度お試しください。",
    unavailable: "ログインサービスを利用できません。後でもう一度お試しください。",
    invalidLink: "ログインまたは確認リンクが無効か、期限切れです。",
    adminRequired: "先にログインしてください。管理ページには管理者権限が必要です。",
    signingIn: "ログイン中...",
    submitting: "処理中...",
  },
} satisfies Record<SiteLanguage, Record<string, string>>;

function callbackUrl(nextPath: string) {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", nextPath);
  return url.toString();
}

export function MemberAuthHub({ initialUser, initialNotice, showPoints = false }: MemberAuthHubProps) {
  const language = useSiteLanguage();
  const text = copy[language];
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(() => {
    if (initialNotice === "admin-auth-required") return text.adminRequired;
    if (initialNotice === "auth_callback_failed") return text.invalidLink;
    if (initialNotice === "auth-unavailable") return text.unavailable;
    return "";
  });

  function clientOrNotice() {
    const client = getSupabaseBrowserClient();
    if (!client) setNotice(text.unavailable);
    return client;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = clientOrNotice();
    if (!supabase) return;

    setBusy(true);
    setNotice("");
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setBusy(false);
    if (error) {
      setNotice(text.loginError);
      return;
    }
    router.replace("/member");
    router.refresh();
  }

  async function handleRegister(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 12) {
      setNotice(text.passwordLength);
      return;
    }
    if (password !== confirmPassword) {
      setNotice(text.passwordMismatch);
      return;
    }
    const supabase = clientOrNotice();
    if (!supabase) return;

    setBusy(true);
    setNotice("");
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { emailRedirectTo: callbackUrl("/member") },
    });
    setBusy(false);
    setPassword("");
    setConfirmPassword("");
    setNotice(error ? text.signupError : text.signupSent);
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const supabase = clientOrNotice();
    if (!supabase) return;

    setBusy(true);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: callbackUrl("/login"),
    });
    setBusy(false);
    setNotice(text.resetGeneric);
  }

  async function handleSignOut() {
    const supabase = clientOrNotice();
    if (!supabase) return;

    setBusy(true);
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <section className="member-hub-section auth-section">
      <div className="wrap member-hub">
        <div className="member-hub-heading">
          <span className="tag">{text.eyebrow}</span>
          <h1>{text.title}</h1>
          <p>{text.description}</p>
        </div>

        {initialUser ? (
          <article className="member-hub-card auth-user-card">
            <div>
              <span className="tag">{initialUser.emailVerified ? "VERIFIED" : "PENDING"}</span>
              <h2>{text.currentUser}</h2>
              <p>{initialUser.email}</p>
              <p>{text.authConnected}</p>
              <p>{initialUser.emailVerified ? text.verified : text.pending}</p>
            </div>
            <button className="btn secondary" type="button" onClick={handleSignOut} disabled={busy}>{text.signOut}</button>
          </article>
        ) : (
          <div className="auth-panel member-hub-card">
            <div className="auth-tabs" role="tablist" aria-label={text.title}>
              {(["login", "register", "forgot"] as AuthMode[]).map((tab) => (
                <button key={tab} type="button" role="tab" aria-selected={mode === tab} className={mode === tab ? "active" : ""} onClick={() => { setMode(tab); setNotice(""); }}>
                  {tab === "login" ? text.login : tab === "register" ? text.register : text.forgot}
                </button>
              ))}
            </div>

            <form className="auth-form" onSubmit={mode === "login" ? handleLogin : mode === "register" ? handleRegister : handleForgotPassword}>
              {mode === "register" && <p>{text.registerHint}</p>}
              {mode === "forgot" && <p>{text.forgotHint}</p>}
              <label>{text.email}<input className="form-input" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" /></label>
              {mode !== "forgot" && <label>{text.password}<input className="form-input" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} minLength={mode === "register" ? 12 : undefined} value={password} onChange={(event) => setPassword(event.target.value)} required /></label>}
              {mode === "register" && <label>{text.confirmPassword}<input className="form-input" type="password" autoComplete="new-password" minLength={12} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label>}
              <button className="btn" type="submit" disabled={busy}>{busy ? (mode === "login" ? text.signingIn : text.submitting) : mode === "login" ? text.signIn : mode === "register" ? text.createAccount : text.sendReset}</button>
            </form>
            {mode === "register" && <p className="auth-security-note">{text.verifyHint}</p>}
          </div>
        )}

        {notice && <p className="member-hub-notice" role="status">{notice}</p>}
        {initialUser && showPoints && <MemberHub user={initialUser} />}
      </div>
    </section>
  );
}
