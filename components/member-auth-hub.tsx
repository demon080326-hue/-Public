"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MemberHub } from "@/components/member-hub";
import { useSiteLanguage } from "@/hooks/use-site-language";
import type { AuthUserSummary } from "@/lib/auth-user";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { SiteLanguage } from "@/lib/site-language";
import type { AuthSecurityStateRow, MemberPointsLedgerRow, MemberTierSettingsRow, ProfileRow } from "@/types/database";

type AuthMode = "login" | "register" | "forgot";

type MemberAuthHubProps = {
  initialUser: AuthUserSummary | null;
  initialProfile?: ProfileRow | null;
  profileStatus?: "ready" | "missing" | "error" | null;
  initialSecurityState?: AuthSecurityStateRow | null;
  securityStatus?: "ready" | "missing" | "error" | null;
  initialNotice?: "admin-auth-required" | "auth_callback_failed" | "auth-unavailable" | "email-verified-member" | "email-verification-required" | "reverification-required" | "reverification-passed" | "password-updated" | "recovery-expired" | "recovery_failed" | "recovery_expired" | null;
  showPoints?: boolean;
  pointsLedger?: MemberPointsLedgerRow[];
  tierSettings?: MemberTierSettingsRow[];
  dailyClaimedToday?: boolean;
  streakDays?: number;
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
    authEmail: "Auth Email",
    authEmailConfirmation: "Auth Email 驗證",
    profileReady: "正式會員 Profile 已建立",
    profileMissing: "會員資料建立中，請重新整理或稍後再試。",
    profileRole: "Profile 角色",
    displayName: "顯示名稱",
    displayNameEmpty: "尚未設定",
    databasePoints: "資料庫點數欄位",
    databasePointsHint: "已由資料庫 ledger 記錄",
    profileVerification: "Profile email_verified",
    activationStatus: "會員啟用狀態",
    activationEmailPending: "請先到信箱完成 Email 驗證",
    activationPending: "會員尚未正式啟用",
    activationMember: "正式會員已啟用",
    activationAdmin: "管理權限已啟用",
    rolePending: "待驗證／待啟用",
    roleMember: "正式會員",
    roleAdmin: "管理員",
    roleOwner: "擁有者",
    verified: "Email 已確認",
    pending: "Email 待確認",
    verifyHint: "註冊後請到信箱完成確認；未確認前不會取得正式會員或管理權限。",
    registerHint: "密碼至少 12 個字元。系統會由 Supabase Auth 寄出確認信。",
    forgotHint: "輸入 Email 後，若帳號存在，系統會寄出重設密碼通知。",
    resetGeneric: "如果這個 Email 已註冊，我們會寄出重設密碼通知。",
    passwordUpdated: "密碼已更新，請使用新密碼登入。",
    recoveryFailed: "重設密碼連結已失效，請重新申請。",
    recoveryExpired: "重設密碼連結已失效或過期，請重新申請忘記密碼。",
    signupSent: "驗證信已寄出，請到信箱完成驗證後再登入。",
    passwordMismatch: "兩次輸入的密碼不一致，請重新確認。",
    passwordLength: "密碼至少需要 12 個字元。",
    loginError: "帳號或密碼錯誤，請確認後再試。",
    signupError: "目前無法建立帳號，請稍後再試。",
    unavailable: "登入服務目前無法使用，請稍後再試。",
    invalidLink: "登入或驗證連結無效或已過期，請重新申請。",
    adminRequired: "請先登入。管理頁面仍須管理員角色，普通會員不會取得後台操作權限。",
    memberActivated: "Email 已驗證，會員已正式啟用。",
    reverificationRequired: "為了保護帳號安全，請先完成 Email 驗證後再登入。",
    reverificationPassed: "Email 重新驗證完成，帳號已解除保護狀態。",
    reverificationTitle: "Email 重新驗證",
    reverificationBody: "此帳號已連續登入失敗 3 次。完成信箱驗證前，會員中心與管理功能都會維持鎖定。",
    verificationEmail: "驗證信箱",
    verificationCode: "6 位數驗證碼",
    sendVerificationCode: "寄送驗證碼",
    resendVerificationCode: "重新寄送驗證碼",
    verifyCode: "完成驗證",
    sendingCode: "寄送中...",
    verifyingCode: "驗證中...",
    codeSent: "如果此帳號需要重新驗證，我們已寄出 6 位數驗證碼。",
    codeSendFailed: "目前無法寄出驗證信，請稍後再試。",
    codeServiceNotConfigured: "驗證信服務尚未設定，請稍後再試。",
    codeVerified: "帳號安全驗證完成，請重新登入。",
    codeInvalid: "驗證碼不正確或已過期，請確認後再試。",
    resendCooldown: "可重新寄送倒數",
    codeHelp: "驗證碼只能輸入 6 位數字，且不會顯示在網站或儲存在瀏覽器。",
    providerNote: "驗證碼由網站伺服器安全產生，資料庫只保存雜湊值；寄信服務未設定時不會顯示或回傳驗證碼。",
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
    authEmail: "Auth email",
    authEmailConfirmation: "Auth email confirmation",
    profileReady: "Member profile created",
    profileMissing: "Your member profile is being created. Refresh or try again later.",
    profileRole: "Profile role",
    displayName: "Display name",
    displayNameEmpty: "Not set",
    databasePoints: "Database points field",
    databasePointsHint: "Backed by the database ledger",
    profileVerification: "Profile email_verified",
    activationStatus: "Membership activation",
    activationEmailPending: "Confirm your email before activating membership",
    activationPending: "Membership is not active yet",
    activationMember: "Membership is active",
    activationAdmin: "Management access is active",
    rolePending: "Pending verification / activation",
    roleMember: "Member",
    roleAdmin: "Administrator",
    roleOwner: "Owner",
    verified: "Email confirmed",
    pending: "Email confirmation pending",
    verifyHint: "Confirm your email after registration. Unverified accounts receive no member or admin access.",
    registerHint: "Use at least 12 characters. Supabase Auth will send the confirmation email.",
    forgotHint: "Enter your email. If the account exists, a password reset notice will be sent.",
    resetGeneric: "If this email is registered, we will send password reset instructions.",
    passwordUpdated: "Your password has been updated. Please sign in with the new password.",
    recoveryFailed: "This reset link is no longer valid. Please request a new one.",
    recoveryExpired: "This reset link has expired. Please request a new one.",
    signupSent: "Registration submitted. Confirm your email before signing in.",
    passwordMismatch: "The passwords do not match.",
    passwordLength: "Use at least 12 characters.",
    loginError: "The email or password is incorrect. Please try again.",
    signupError: "We cannot create the account right now. Please try again later.",
    unavailable: "The sign-in service is unavailable. Please try again later.",
    invalidLink: "This sign-in or verification link is invalid or expired.",
    adminRequired: "Please sign in first. Admin pages still require an administrator role.",
    memberActivated: "Email confirmed. Your membership is now active.",
    reverificationRequired: "For account security, complete email verification before signing in again.",
    reverificationPassed: "Email reverification is complete and the account protection state is cleared.",
    reverificationTitle: "Email reverification",
    reverificationBody: "This account has reached three consecutive failed sign-in attempts. Member and admin access remain locked until verification is complete.",
    verificationEmail: "Verification email",
    verificationCode: "6-digit verification code",
    sendVerificationCode: "Send verification code",
    resendVerificationCode: "Resend verification code",
    verifyCode: "Verify account",
    sendingCode: "Sending...",
    verifyingCode: "Verifying...",
    codeSent: "If this account requires reverification, we have sent a 6-digit code.",
    codeSendFailed: "We cannot send the verification email right now. Please try again later.",
    codeServiceNotConfigured: "The verification email service is not configured. Please try again later.",
    codeVerified: "Account security verification is complete. Please sign in again.",
    codeInvalid: "The code is incorrect or expired. Please check it and try again.",
    resendCooldown: "Resend available in",
    codeHelp: "Only six digits are accepted. The code is never displayed by the site or stored in the browser.",
    providerNote: "Codes are generated securely on the server and only a hash is stored. Codes are never displayed or returned when email delivery is unavailable.",
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
    authEmail: "Auth メール",
    authEmailConfirmation: "Auth メール確認",
    profileReady: "正式な会員プロフィールを作成済み",
    profileMissing: "会員情報を作成中です。再読み込みするか、しばらくしてからお試しください。",
    profileRole: "プロフィール権限",
    displayName: "表示名",
    displayNameEmpty: "未設定",
    databasePoints: "データベースのポイント欄",
    databasePointsHint: "データベース台帳で記録されています",
    profileVerification: "プロフィール email_verified",
    activationStatus: "会員の有効化状態",
    activationEmailPending: "メール確認を完了してください",
    activationPending: "会員はまだ有効化されていません",
    activationMember: "正式会員として有効です",
    activationAdmin: "管理権限が有効です",
    rolePending: "確認／有効化待ち",
    roleMember: "正式会員",
    roleAdmin: "管理者",
    roleOwner: "オーナー",
    verified: "メール確認済み",
    pending: "メール確認待ち",
    verifyHint: "登録後にメール確認を完了してください。未確認のアカウントには正式な権限は付与されません。",
    registerHint: "12文字以上で設定してください。確認メールは Supabase Auth から送信されます。",
    forgotHint: "メールを入力してください。登録済みの場合は再設定案内が送信されます。",
    resetGeneric: "登録済みのメールの場合、パスワード再設定の案内を送信します。",
    passwordUpdated: "パスワードを更新しました。新しいパスワードでログインしてください。",
    recoveryFailed: "再設定リンクは無効です。もう一度申請してください。",
    recoveryExpired: "再設定リンクの有効期限が切れています。もう一度申請してください。",
    signupSent: "登録を受け付けました。メール確認後にログインしてください。",
    passwordMismatch: "パスワードが一致しません。",
    passwordLength: "パスワードは12文字以上必要です。",
    loginError: "メールアドレスまたはパスワードが正しくありません。",
    signupError: "現在アカウントを作成できません。後でもう一度お試しください。",
    unavailable: "ログインサービスを利用できません。後でもう一度お試しください。",
    invalidLink: "ログインまたは確認リンクが無効か、期限切れです。",
    adminRequired: "先にログインしてください。管理ページには管理者権限が必要です。",
    memberActivated: "メール確認済みです。正式会員として有効になりました。",
    reverificationRequired: "アカウント保護のため、再ログイン前にメール確認を完了してください。",
    reverificationPassed: "メール再確認が完了し、アカウントの保護状態を解除しました。",
    reverificationTitle: "メール再確認",
    reverificationBody: "ログインに3回連続で失敗したため、確認が完了するまで会員・管理機能をロックしています。",
    verificationEmail: "確認メール",
    verificationCode: "6桁の確認コード",
    sendVerificationCode: "確認コードを送信",
    resendVerificationCode: "確認コードを再送信",
    verifyCode: "確認を完了",
    sendingCode: "送信中...",
    verifyingCode: "確認中...",
    codeSent: "このアカウントに再確認が必要な場合、6桁のコードを送信しました。",
    codeSendFailed: "現在、確認メールを送信できません。しばらくしてからお試しください。",
    codeServiceNotConfigured: "確認メールサービスは未設定です。しばらくしてからお試しください。",
    codeVerified: "アカウントの安全確認が完了しました。もう一度ログインしてください。",
    codeInvalid: "コードが正しくないか期限切れです。確認してもう一度お試しください。",
    resendCooldown: "再送信まで",
    codeHelp: "入力できるのは6桁の数字のみです。コードは画面表示やブラウザ保存を行いません。",
    providerNote: "コードはサーバーで安全に生成され、データベースにはハッシュのみ保存されます。送信設定がない場合もコードを表示・返却しません。",
    signingIn: "ログイン中...",
    submitting: "処理中...",
  },
} satisfies Record<SiteLanguage, Record<string, string>>;

function callbackUrl(nextPath: string) {
  const url = new URL("/auth/callback", window.location.origin);
  url.searchParams.set("next", nextPath);
  return url.toString();
}

function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!domain) return "***";
  const visible = name.slice(0, 1);
  return `${visible}${"*".repeat(Math.max(3, Math.min(name.length - 1, 8)))}@${domain}`;
}

export function MemberAuthHub({
  initialUser,
  initialProfile = null,
  profileStatus = null,
  initialSecurityState = null,
  securityStatus = null,
  initialNotice,
  showPoints = false,
  pointsLedger = [],
  tierSettings = [],
  dailyClaimedToday = false,
  streakDays = 0,
}: MemberAuthHubProps) {
  const language = useSiteLanguage();
  const text = copy[language];
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [verificationCodeRequested, setVerificationCodeRequested] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(() => {
    if (initialNotice === "admin-auth-required") return text.adminRequired;
    if (initialNotice === "auth_callback_failed") return text.invalidLink;
    if (initialNotice === "auth-unavailable") return text.unavailable;
    if (initialNotice === "email-verified-member") return text.memberActivated;
    if (initialNotice === "email-verification-required") return text.activationEmailPending;
    if (initialNotice === "reverification-required") return text.reverificationRequired;
    if (initialNotice === "reverification-passed") return text.reverificationPassed;
    if (initialNotice === "password-updated") return text.passwordUpdated;
    if (initialNotice === "recovery-expired") return text.recoveryExpired;
    if (initialNotice === "recovery_failed") return text.recoveryFailed;
    if (initialNotice === "recovery_expired") return text.recoveryExpired;
    return "";
  });
  const requiresReverification = initialSecurityState?.requires_reverification === true;
  const roleLabel = initialProfile
    ? initialProfile.role === "owner"
      ? text.roleOwner
      : initialProfile.role === "admin"
        ? text.roleAdmin
        : initialProfile.role === "member"
          ? text.roleMember
          : text.rolePending
    : null;
  const activationLabel = !initialUser?.emailVerified
    ? text.activationEmailPending
    : initialProfile?.role === "pending_member"
      ? text.activationPending
      : initialProfile?.role === "member"
        ? text.activationMember
        : initialProfile?.role === "admin" || initialProfile?.role === "owner"
          ? text.activationAdmin
          : text.activationPending;

  useEffect(() => {
    if (resendCooldownSeconds <= 0) return;
    const timer = window.setTimeout(() => {
      setResendCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [resendCooldownSeconds]);

  function clientOrNotice() {
    const client = getSupabaseBrowserClient();
    if (!client) setNotice(text.unavailable);
    return client;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setNotice("");

    let response: Response;
    let result: { ok?: boolean; requiresReverification?: boolean; memberActivated?: boolean } = {};
    try {
      response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      result = (await response.json()) as typeof result;
    } catch {
      setBusy(false);
      setNotice(text.unavailable);
      return;
    }

    setPassword("");
    if (!response.ok || result.ok !== true) {
      setBusy(false);
      setNotice(response.status === 503 ? text.unavailable : text.loginError);
      return;
    }

    setBusy(false);
    if (result.requiresReverification) {
      router.replace("/login?notice=reverification-required");
      router.refresh();
      return;
    }

    router.replace(result.memberActivated ? "/member?notice=email-verified-member" : "/member");
    router.refresh();
  }

  async function handleRequestVerificationCode() {
    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/auth/reverification/request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: initialUser?.email || "" }),
      });
      const result = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (!response.ok) {
        setNotice(result?.error === "EMAIL_NOT_CONFIGURED" ? text.codeServiceNotConfigured : text.codeSendFailed);
      } else {
        setVerificationCodeRequested(true);
        setResendCooldownSeconds(60);
        setNotice(text.codeSent);
      }
    } catch {
      setNotice(text.unavailable);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(verificationCode)) {
      setNotice(text.codeInvalid);
      return;
    }

    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/auth/reverification/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: initialUser?.email || "", code: verificationCode }),
      });

      if (!response.ok) {
        setNotice(response.status === 503 ? text.unavailable : text.codeInvalid);
        return;
      }

      setVerificationCode("");
      setNotice(text.codeVerified);
      router.replace("/login?notice=reverification-passed");
      router.refresh();
    } catch {
      setNotice(text.unavailable);
    } finally {
      setBusy(false);
    }
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
    const resetPasswordUrl = new URL("/reset-password", window.location.origin);
    await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: resetPasswordUrl.toString(),
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

        {initialUser && requiresReverification ? (
          <article className="member-hub-card reverification-card">
            <div>
              <span className="tag">REVERIFICATION REQUIRED</span>
              <h2>{text.reverificationTitle}</h2>
              <p>{text.reverificationBody}</p>
            </div>
            <dl className="member-profile-details">
              <div><dt>{text.verificationEmail}</dt><dd>{maskEmail(initialUser.email)}</dd></div>
              <div><dt>{text.profileRole}</dt><dd>{initialProfile?.role ?? "pending_member"}</dd></div>
              <div><dt>Security state</dt><dd>{securityStatus === "ready" ? "requires_reverification" : "unavailable"}</dd></div>
            </dl>
            <button className="btn secondary" type="button" onClick={handleRequestVerificationCode} disabled={busy || resendCooldownSeconds > 0}>
              {busy
                ? text.sendingCode
                : resendCooldownSeconds > 0
                  ? `${text.resendCooldown} ${resendCooldownSeconds}s`
                  : verificationCodeRequested
                    ? text.resendVerificationCode
                    : text.sendVerificationCode}
            </button>
            <form className="member-verify-form" onSubmit={handleVerifyCode}>
              <label>
                {text.verificationCode}
                <input
                  className="form-input verification-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]{6}"
                  maxLength={6}
                  value={verificationCode}
                  onChange={(event) => setVerificationCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
                  required
                />
              </label>
              <small>{text.codeHelp}</small>
              <button className="btn" type="submit" disabled={busy || verificationCode.length !== 6}>
                {busy ? text.verifyingCode : text.verifyCode}
              </button>
            </form>
            <p className="auth-security-note">{text.providerNote}</p>
            <button className="btn secondary" type="button" onClick={handleSignOut} disabled={busy}>{text.signOut}</button>
          </article>
        ) : initialUser ? (
          <article className="member-hub-card auth-user-card">
            <div>
              <span className="tag">{initialUser.emailVerified ? "VERIFIED" : "PENDING"}</span>
              <h2>{text.currentUser}</h2>
              <p>{text.authConnected}</p>
              {initialProfile ? (
                <dl className="member-profile-details">
                  <div><dt>{text.authEmail}</dt><dd>{initialUser.email}</dd></div>
                  <div><dt>{text.authEmailConfirmation}</dt><dd>{initialUser.emailVerified ? text.verified : text.pending}</dd></div>
                  <div><dt>{text.profileVerification}</dt><dd>{initialProfile.email_verified ? text.verified : text.pending}</dd></div>
                  <div><dt>{text.profileRole}</dt><dd>{roleLabel} <small>({initialProfile.role})</small></dd></div>
                  <div><dt>{text.activationStatus}</dt><dd>{activationLabel}</dd></div>
                  <div><dt>{text.displayName}</dt><dd>{initialProfile.display_name || text.displayNameEmpty}</dd></div>
                  <div><dt>{text.databasePoints}</dt><dd>{initialProfile.points_balance} · {text.databasePointsHint}</dd></div>
                </dl>
              ) : (
                <p className="profile-status-warning" role="status">{text.profileMissing}</p>
              )}
              {profileStatus === "ready" && <small className="profile-ready-label">{text.profileReady}</small>}
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
        {initialUser && initialProfile && showPoints && (
          <MemberHub
            user={initialUser}
            profile={initialProfile}
            ledger={pointsLedger}
            tierSettings={tierSettings}
            dailyClaimedToday={dailyClaimedToday}
            streakDays={streakDays}
          />
        )}
      </div>
    </section>
  );
}
