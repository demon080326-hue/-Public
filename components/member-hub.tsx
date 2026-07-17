"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useSiteLanguage } from "@/hooks/use-site-language";
import type { AuthUserSummary } from "@/lib/auth-user";
import { translateSiteText } from "@/lib/site-language";

type PointRecord = {
  id: string;
  label: string;
  amount: number;
  date: string;
};

type PointProfile = {
  points: number;
  dailyClaimedOn: string | null;
  weeklyClaimedOn: string | null;
  records: PointRecord[];
};

const legacyStorageKey = "james-member-mvp-v2";
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

function storageKey(userId: string) {
  return `james-member-points-mvp-v3:${userId}`;
}

function emptyProfile(): PointProfile {
  return { points: 0, dailyClaimedOn: null, weeklyClaimedOn: null, records: [] };
}

function normalizeProfile(value: Partial<PointProfile> | null): PointProfile {
  return {
    points: Number(value?.points ?? 0),
    dailyClaimedOn: value?.dailyClaimedOn ?? null,
    weeklyClaimedOn: value?.weeklyClaimedOn ?? null,
    records: Array.isArray(value?.records) ? value.records : [],
  };
}

function readProfile(user: AuthUserSummary): PointProfile {
  try {
    const current = JSON.parse(localStorage.getItem(storageKey(user.id)) ?? "null") as Partial<PointProfile> | null;
    if (current) return normalizeProfile(current);

    const legacy = JSON.parse(localStorage.getItem(legacyStorageKey) ?? "null") as (Partial<PointProfile> & { email?: string }) | null;
    if (legacy?.email?.toLowerCase() === user.email.toLowerCase()) return normalizeProfile(legacy);
    return emptyProfile();
  } catch {
    return emptyProfile();
  }
}

function saveProfile(userId: string, profile: PointProfile) {
  localStorage.setItem(storageKey(userId), JSON.stringify(profile));
}

export function MemberHub({ user }: { user: AuthUserSummary }) {
  const language = useSiteLanguage();
  const t = (text: string) => translateSiteText(text, language);
  const [profile, setProfile] = useState<PointProfile | null>(null);
  const [notice, setNotice] = useState("點數 MVP 僅儲存在這台裝置，不可兌現或轉移。");

  useEffect(() => {
    const loadProfile = window.setTimeout(() => setProfile(readProfile(user)), 0);
    return () => window.clearTimeout(loadProfile);
  }, [user]);

  const today = taipeiDate();
  const thisWeek = weekKey(new Date());
  const canDailyClaim = Boolean(user.emailVerified && profile && profile.dailyClaimedOn !== today);
  const canWeeklyClaim = Boolean(user.emailVerified && profile && profile.weeklyClaimedOn !== thisWeek);
  const records = useMemo(() => profile?.records ?? [], [profile]);

  function updateProfile(nextProfile: PointProfile) {
    saveProfile(user.id, nextProfile);
    setProfile(nextProfile);
  }

  function claimPoints(kind: "daily" | "weekly") {
    if (!user.emailVerified || !profile) {
      setNotice("請先完成正式 Email 確認，才能使用本機點數 MVP。");
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
    <div className="member-points-mvp">
        <div className="member-hub-heading member-points-heading">
          <span className="tag">LOCAL POINTS MVP</span>
          <h2>{t("目前點數")}</h2>
          <p>{t("點數 MVP 僅儲存在這台裝置，不可兌現或轉移。")}</p>
        </div>
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
  );
}
