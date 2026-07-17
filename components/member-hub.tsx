"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useSiteLanguage } from "@/hooks/use-site-language";
import { translateSiteText } from "@/lib/site-language";

type PointRecord = {
  id: string;
  label: string;
  amount: number;
  date: string;
};

type MemberProfile = {
  email: string;
  verified: boolean;
  points: number;
  dailyClaimedOn: string | null;
  weeklyClaimedOn: string | null;
  records: PointRecord[];
};

const storageKey = "james-member-mvp-v2";
const dailyPoints = 10;
const weeklyPoints = 30;

function taipeiDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(new Date());
}

function weekKey(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(date)
    .reduce<Record<string, string>>((result, part) => ({ ...result, [part.type]: part.value }), {});
  const utcDate = new Date(Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() - day + 1);
  return utcDate.toISOString().slice(0, 10);
}

function readProfile(): MemberProfile | null {
  try {
    const value = JSON.parse(localStorage.getItem(storageKey) ?? "null") as Partial<MemberProfile> | null;
    if (!value?.email) return null;
    return {
      email: value.email,
      verified: Boolean(value.verified),
      points: Number(value.points ?? 0),
      dailyClaimedOn: value.dailyClaimedOn ?? null,
      weeklyClaimedOn: value.weeklyClaimedOn ?? null,
      records: Array.isArray(value.records) ? value.records : [],
    };
  } catch {
    return null;
  }
}

function saveProfile(profile: MemberProfile) {
  localStorage.setItem(storageKey, JSON.stringify(profile));
}

export function MemberHub() {
  const language = useSiteLanguage();
  const t = (text: string) => translateSiteText(text, language);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [code, setCode] = useState("");
  const [notice, setNotice] = useState("正式會員需要完成 Email 驗證後才會啟用。此頁目前為測試模式，不會寄出真實信件，也不會提供後台或付費內容權限。");

  useEffect(() => {
    const loadProfile = window.setTimeout(() => setProfile(readProfile()), 0);
    return () => window.clearTimeout(loadProfile);
  }, []);

  const today = taipeiDate();
  const thisWeek = weekKey(new Date());
  const canDailyClaim = Boolean(profile?.verified && profile.dailyClaimedOn !== today);
  const canWeeklyClaim = Boolean(profile?.verified && profile.weeklyClaimedOn !== thisWeek);
  const records = useMemo(() => profile?.records ?? [], [profile]);

  function updateProfile(nextProfile: MemberProfile) {
    saveProfile(nextProfile);
    setProfile(nextProfile);
  }

  function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (password.length < 8) {
      setNotice("密碼至少需要 8 個字元。此 MVP 不會儲存密碼，正式登入將在 Supabase Auth 上線後啟用。");
      return;
    }
    if (password !== confirmPassword) {
      setNotice("兩次輸入的密碼不一致，請重新確認。");
      return;
    }

    updateProfile({ email: email.trim(), verified: false, points: 0, dailyClaimedOn: null, weeklyClaimedOn: null, records: [] });
    setPassword("");
    setConfirmPassword("");
    setNotice("已寄出 6 位數驗證碼到信箱。信箱驗證功能建置中；目前為測試模式，不會寄出真實 Email。");
  }

  function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || !/^\d{6}$/.test(code)) {
      setNotice("請輸入 6 位數字驗證碼。");
      return;
    }
    updateProfile({ ...profile, verified: true });
    setCode("");
    setNotice("已完成測試模式驗證。你現在是已驗證會員，但不具管理後台、付費商品或下載內容的正式權限。");
  }

  function claimPoints(kind: "daily" | "weekly") {
    if (!profile?.verified) {
      setNotice("請先完成測試模式的 6 位數 Email 驗證，才能使用點數 MVP。");
      return;
    }
    const isDaily = kind === "daily";
    const alreadyClaimed = isDaily ? profile.dailyClaimedOn === today : profile.weeklyClaimedOn === thisWeek;
    if (alreadyClaimed) {
      setNotice(isDaily ? "今天已完成簽到，明天再回來吧。" : "本週加點已領取，下週再回來吧。");
      return;
    }
    const amount = isDaily ? dailyPoints : weeklyPoints;
    const record: PointRecord = {
      id: `${kind}-${Date.now()}`,
      label: isDaily ? "每日簽到" : "每週加點",
      amount,
      date: today,
    };
    updateProfile({
      ...profile,
      points: profile.points + amount,
      dailyClaimedOn: isDaily ? today : profile.dailyClaimedOn,
      weeklyClaimedOn: isDaily ? profile.weeklyClaimedOn : thisWeek,
      records: [record, ...profile.records].slice(0, 12),
    });
    setNotice(isDaily ? `每日簽到成功，已增加 ${dailyPoints} 點。` : `每週加點成功，已增加 ${weeklyPoints} 點。`);
  }

  return (
    <section className="member-hub-section">
      <div className="wrap member-hub">
        <div className="member-hub-heading">
          <span className="tag">MEMBER MVP</span>
          <h1>{t("會員中心")}</h1>
          <p>{t("正式會員需要完成 Email 驗證後才會啟用。現在是前端測試模式，不會寄信、不會建立正式帳號，也不提供後台、商城或下載解鎖權限。")}</p>
        </div>

        {!profile ? (
          <form className="member-hub-card member-register-form" onSubmit={register}>
            <h2>{t("註冊帳號")}</h2>
            <p>{t("先申請會員帳號；密碼只在本次表單驗證使用，不會儲存在瀏覽器。")}</p>
            <label>{t("Email")}<input className="form-input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required placeholder="you@example.com" /></label>
            <label>{t("密碼")}<input className="form-input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} required /></label>
            <label>{t("確認密碼")}<input className="form-input" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={8} required /></label>
            <button className="btn" type="submit">{t("申請會員帳號")}</button>
          </form>
        ) : !profile.verified ? (
          <form className="member-hub-card member-verify-form" onSubmit={verifyCode}>
            <span className="tag">PENDING</span>
            <h2>{t("待驗證會員")}</h2>
            <p>{profile.email}</p>
            <p>{t("已寄出 6 位數驗證碼到信箱。信箱驗證功能建置中，請以測試模式完成流程預覽。")}</p>
            <label>{t("6 位數驗證碼")}<input className="form-input verification-code" inputMode="numeric" pattern="[0-9]{6}" maxLength={6} value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} required placeholder="000000" /></label>
            <button className="btn" type="submit">{t("驗證帳號（測試模式）")}</button>
          </form>
        ) : (
          <div className="member-summary member-hub-card">
            <span className="tag">VERIFIED · TEST MODE</span>
            <h2>{t("已驗證會員")}</h2>
            <p>{profile.email}</p>
            <p>{t("這是測試模式會員狀態，不代表完成正式 Email 驗證，也不會開放管理後台、付費商品或下載內容。")}</p>
          </div>
        )}

        <p className="member-hub-notice" role="status">{t(notice)}</p>

        <div className="member-points-grid">
          <article className="member-hub-card points-card"><span>{t("目前點數")}</span><strong>{profile?.points ?? 0}</strong><small>{t("點數 MVP 僅儲存在這台裝置，不可兌現或轉移。")}</small></article>
          <article className="member-hub-card"><h2>{t("每日簽到")}</h2><p>{profile?.dailyClaimedOn === today ? t("今天已簽到") : t("今天尚未簽到")}</p><button className="btn" type="button" disabled={!canDailyClaim} onClick={() => claimPoints("daily")}>{profile?.dailyClaimedOn === today ? t("今日已簽到") : t("每日簽到 +10")}</button></article>
          <article className="member-hub-card"><h2>{t("每週加點")}</h2><p>{profile?.weeklyClaimedOn === thisWeek ? t("本週已領取") : t("本週尚未領取")}</p><button className="btn secondary" type="button" disabled={!canWeeklyClaim} onClick={() => claimPoints("weekly")}>{profile?.weeklyClaimedOn === thisWeek ? t("本週已加點") : t("每週加點 +30")}</button></article>
        </div>

        <div className="member-hub-grid">
          <article className="member-hub-card"><h2>{t("點數紀錄")}</h2>{records.length ? <ul className="point-records">{records.map((record) => <li key={record.id}><span>{t(record.label)}</span><strong>+{record.amount}</strong><small>{record.date}</small></li>)}</ul> : <p>{t("尚無點數紀錄。完成驗證後可以每日簽到與每週加點。")}</p>}</article>
          <article className="member-hub-card"><h2>{t("可兌換商品")}</h2><p>{t("商品待研究。目前不提供實體商品、物流、金流或點數兌換。")}</p><span className="member-placeholder">{t("商品待研究")}</span></article>
          <article className="member-hub-card"><h2>{t("會員可瀏覽")}</h2><p>{t("一般會員可查看公開內容；AI 情報、工具與文章不需要付費解鎖。")}</p><div className="member-hub-links"><Link href="/news">{t("AI 情報中心")}</Link><Link href="/tools">{t("AI 工具")}</Link><Link href="/articles">{t("學習文章")}</Link></div></article>
        </div>
      </div>
    </section>
  );
}
