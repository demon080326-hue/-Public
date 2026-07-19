"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type RecoveryState = "checking" | "ready" | "expired" | "missing" | "unavailable";

const EXPIRED_NOTICE = "重設密碼連結已失效或過期，請回登入頁重新申請忘記密碼。";
const MISSING_NOTICE = "請先從最新的重設密碼信件進入此頁。";

function getUrlValue(name: string) {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return hash.get(name) ?? query.get(name);
}

function hasExpiredRecoveryError() {
  const error = getUrlValue("error")?.toLowerCase();
  const errorCode = getUrlValue("error_code")?.toLowerCase();
  const description = getUrlValue("error_description")?.toLowerCase() ?? "";

  return error === "access_denied"
    || errorCode === "otp_expired"
    || description.includes("invalid")
    || description.includes("expired");
}

function hasRecoveryIntent() {
  return Boolean(
    getUrlValue("code")
    || getUrlValue("type") === "recovery"
    || getUrlValue("recovery") === "verified"
    || window.location.hash.includes("access_token="),
  );
}

function replaceWithExpiredState() {
  window.history.replaceState(null, "", "/reset-password?error=access_denied&error_code=otp_expired");
}

function replaceWithVerifiedState() {
  window.history.replaceState(null, "", "/reset-password?recovery=verified");
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [state, setState] = useState<RecoveryState>("checking");
  const [notice, setNotice] = useState("正在確認重設密碼連結...");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    let unsubscribe: (() => void) | undefined;

    async function prepareRecoverySession() {
      if (hasExpiredRecoveryError()) {
        setState("expired");
        setNotice(EXPIRED_NOTICE);
        return;
      }

      // Read the recovery evidence before Supabase consumes the URL fragment.
      const recoveryIntent = hasRecoveryIntent();
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!alive) return;
        setState("unavailable");
        setNotice("登入服務目前無法使用，請稍後再試。");
        return;
      }

      let recoveryEventReceived = false;
      const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
        if (!alive || event !== "PASSWORD_RECOVERY" || !session) return;
        recoveryEventReceived = true;
        setState("ready");
        setNotice("請設定新的密碼，完成後再使用新密碼登入。");
        replaceWithVerifiedState();
      });
      unsubscribe = () => listener.subscription.unsubscribe();

      const code = searchParams.get("code") ?? getUrlValue("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!alive) return;
          setState("expired");
          setNotice(EXPIRED_NOTICE);
          replaceWithExpiredState();
          unsubscribe();
          return;
        }
        replaceWithVerifiedState();
      }

      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;
      if (error || !data.session || (!recoveryIntent && !recoveryEventReceived)) {
        setState("missing");
        setNotice(MISSING_NOTICE);
        unsubscribe();
        return;
      }

      setState("ready");
      setNotice("請設定新的密碼，完成後再使用新密碼登入。");
      replaceWithVerifiedState();
      unsubscribe();
    }

    void prepareRecoverySession();
    return () => {
      alive = false;
      unsubscribe?.();
    };
  }, [searchParams]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (state !== "ready") return;
    if (password.length < 8) {
      setNotice("新密碼至少需要 8 碼。");
      return;
    }
    if (password !== confirmPassword) {
      setNotice("兩次輸入的新密碼不一致，請重新確認。");
      return;
    }

    const supabase = getSupabaseBrowserClient();
    if (!supabase) {
      setNotice("登入服務目前無法使用，請稍後再試。");
      return;
    }

    setBusy(true);
    setNotice("");
    const { error } = await supabase.auth.updateUser({ password });
    setPassword("");
    setConfirmPassword("");

    if (error) {
      setBusy(false);
      const message = error.message?.toLowerCase() ?? "";
      if (message.includes("expired") || message.includes("invalid") || message.includes("session")) {
        setState("expired");
        setNotice(EXPIRED_NOTICE);
        replaceWithExpiredState();
      } else {
        setNotice("密碼更新失敗，請重新申請重設密碼連結。");
      }
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?notice=password-updated");
    router.refresh();
  }

  if (state !== "ready") {
    return (
      <article className="member-hub-card">
        <p className="member-hub-notice" role={state === "expired" ? "alert" : "status"}>{notice}</p>
        {state !== "checking" && (
          <Link
            className="btn secondary"
            href={state === "expired" ? "/login?notice=recovery-expired" : "/login"}
          >
            {state === "expired" ? "回登入頁重新申請" : "回登入頁"}
          </Link>
        )}
      </article>
    );
  }

  return (
    <article className="member-hub-card auth-user-card">
      <form className="auth-form" onSubmit={handleSubmit}>
        <p className="member-hub-notice" role="status">{notice}</p>
        <label>
          新密碼
          <input
            className="form-input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            disabled={busy}
            required
          />
        </label>
        <label>
          確認新密碼
          <input
            className="form-input"
            type="password"
            autoComplete="new-password"
            minLength={8}
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            disabled={busy}
            required
          />
        </label>
        <button className="btn" type="submit" disabled={busy}>
          {busy ? "更新中..." : "更新密碼"}
        </button>
      </form>
    </article>
  );
}
