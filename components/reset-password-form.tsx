"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type RecoveryState = "checking" | "ready" | "invalid";

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

    async function prepareRecoverySession() {
      const supabase = getSupabaseBrowserClient();
      if (!supabase) {
        if (!alive) return;
        setState("invalid");
        setNotice("登入服務目前無法使用，請稍後再試。");
        return;
      }

      const code = searchParams.get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          if (!alive) return;
          setState("invalid");
          setNotice("重設密碼連結已失效或已過期，請重新申請。");
          window.history.replaceState(null, "", "/reset-password");
          return;
        }
        window.history.replaceState(null, "", "/reset-password");
      }

      const { data, error } = await supabase.auth.getSession();
      if (!alive) return;
      if (error || !data.session) {
        setState("invalid");
        setNotice("請先從信箱中的重設密碼連結進入此頁。");
        return;
      }

      setState("ready");
      setNotice("請設定新的密碼，完成後再使用新密碼登入。");
    }

    void prepareRecoverySession();
    return () => {
      alive = false;
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
      setNotice(error.message?.toLowerCase().includes("expired") ? "重設密碼連結已過期，請重新申請。" : "密碼更新失敗，請重新申請重設密碼連結。");
      return;
    }

    await supabase.auth.signOut();
    router.replace("/login?notice=password-updated");
    router.refresh();
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
            disabled={busy || state !== "ready"}
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
            disabled={busy || state !== "ready"}
            required
          />
        </label>
        <button className="btn" type="submit" disabled={busy || state !== "ready"}>
          {busy ? "更新中..." : "更新密碼"}
        </button>
        {state === "invalid" && <Link className="btn secondary" href="/login">回登入頁重新申請</Link>}
      </form>
    </article>
  );
}
