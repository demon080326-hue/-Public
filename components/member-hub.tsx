"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useSiteLanguage } from "@/hooks/use-site-language";
import type { AuthUserSummary } from "@/lib/auth-user";
import { getTierLabel, getTierProgress } from "@/lib/member-tier";
import { translateSiteText } from "@/lib/site-language";
import type { MemberPointsLedgerRow, MemberTierSettingsRow, ProfileRow } from "@/types/database";

type MemberHubProps = {
  user: AuthUserSummary;
  profile: ProfileRow;
  ledger: MemberPointsLedgerRow[];
  tierSettings: MemberTierSettingsRow[];
  dailyClaimedToday: boolean;
  streakDays: number;
};

type CheckinResult = {
  ok?: boolean;
  reason?: string;
  claimed?: boolean;
  already_claimed?: boolean;
  daily_points?: number;
  streak_bonus_points?: number;
  streak_days?: number;
  points_balance?: number;
  lifetime_earned_points?: number;
  current_tier?: ProfileRow["current_tier"];
  highest_tier?: ProfileRow["highest_tier"];
  minimum_tier?: ProfileRow["minimum_tier"];
};

const futureFeatures = [
  {
    title: "商品收藏",
    body: "未來會用來收藏喜歡的工具包或商品；第 9 階段只標記為未來功能。",
  },
  {
    title: "訂單紀錄",
    body: "正式金流上線後才會建立訂單紀錄；目前不假造購買資料。",
  },
  {
    title: "點數折抵",
    body: "點數折抵會等正式商城與規則完成後再開放，本階段不能折抵。",
  },
  {
    title: "平民專屬活動",
    body: "活動報名與管理會放在後續階段，現在先顯示暫未開放。",
  },
];

function formatDateTime(value: string | null) {
  if (!value) return "尚無紀錄";
  return new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function sourceLabel(sourceType: MemberPointsLedgerRow["source_type"]) {
  const labels: Record<MemberPointsLedgerRow["source_type"], string> = {
    daily_checkin: "每日簽到",
    streak_bonus_7_days: "連續 7 天簽到獎勵",
    monthly_full_checkin_bonus: "整月簽到獎勵（未開放）",
    yearly_full_checkin_bonus: "整年簽到獎勵（未開放）",
    purchase_reward: "購買回饋（未開放）",
    admin_adjustment: "管理員調整（未開放）",
    redemption: "點數兌換（未開放）",
    refund_reversal: "退款回沖（未開放）",
    migration: "系統轉移",
  };
  return labels[sourceType] ?? sourceType;
}

export function MemberHub({
  user,
  profile,
  ledger,
  tierSettings,
  dailyClaimedToday,
  streakDays,
}: MemberHubProps) {
  const language = useSiteLanguage();
  const router = useRouter();
  const t = (text: string) => translateSiteText(text, language);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("會員點數已改為資料庫紀錄；每日簽到與 7 天連續獎勵會寫入 ledger。");
  const [stats, setStats] = useState({
    pointsBalance: profile.points_balance,
    lifetimeEarnedPoints: profile.lifetime_earned_points,
    currentTier: profile.current_tier,
    highestTier: profile.highest_tier,
    minimumTier: profile.minimum_tier,
    dailyClaimedToday,
    streakDays,
  });

  const latestRecords = useMemo(() => ledger.slice(0, 8), [ledger]);
  const tierProgress = getTierProgress({
    role: profile.role,
    emailVerified: profile.email_verified,
    lifetimeEarnedPoints: stats.lifetimeEarnedPoints,
    totalValidSpend: profile.total_valid_spend,
    currentTier: stats.currentTier,
    minimumTier: stats.minimumTier,
    upgradeDisabled: profile.upgrade_disabled,
  });

  async function claimDailyCheckin() {
    if (!user.emailVerified || !profile.email_verified || profile.role === "pending_member") {
      setNotice("正式會員完成 Email 驗證後，才能使用每日簽到。");
      return;
    }

    setBusy(true);
    setNotice("");
    try {
      const response = await fetch("/api/member/checkin", { method: "POST" });
      const result = (await response.json().catch(() => null)) as CheckinResult | null;

      if (!response.ok || !result?.ok) {
        setNotice(result?.reason === "NOT_ELIGIBLE" ? "目前會員狀態尚未符合簽到資格。" : "簽到暫時無法完成，請稍後再試。");
        return;
      }

      setStats((current) => ({
        pointsBalance: Number(result.points_balance ?? current.pointsBalance),
        lifetimeEarnedPoints: Number(result.lifetime_earned_points ?? current.lifetimeEarnedPoints),
        currentTier: result.current_tier ?? current.currentTier,
        highestTier: result.highest_tier ?? current.highestTier,
        minimumTier: result.minimum_tier ?? current.minimumTier,
        dailyClaimedToday: true,
        streakDays: Number(result.streak_days ?? current.streakDays),
      }));

      if (result.already_claimed) {
        setNotice("今天已經簽到過了，明天再回來領點數。");
      } else {
        const bonus = Number(result.streak_bonus_points ?? 0);
        setNotice(bonus > 0 ? `簽到成功，獲得 +2 點，連續 7 天額外獲得 +${bonus} 點。` : "簽到成功，獲得 +2 點。");
      }

      router.refresh();
    } catch {
      setNotice("簽到暫時無法完成，請稍後再試。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="member-points-mvp">
      <div className="member-hub-heading member-points-heading">
        <span className="tag">DATABASE POINTS MVP</span>
        <h2>{t("會員點數與階級")}</h2>
        <p>{t("第 9 階段已將點數改為資料庫紀錄，先開放每日簽到、7 天連續簽到基礎判定與會員階級顯示。")}</p>
      </div>
      <p className="member-hub-notice" role="status">{t(notice)}</p>

      <div className="member-points-grid">
        <article className="member-hub-card points-card">
          <span>{t("可使用點數")}</span>
          <strong>{stats.pointsBalance}</strong>
          <small>{t("由 member_points_ledger 產生，不再使用 localStorage 假解鎖。")}</small>
        </article>
        <article className="member-hub-card">
          <h2>{t("目前階級")}</h2>
          <p className="member-tier-name">{getTierLabel(stats.currentTier)}</p>
          <small>{t(`tier key：${stats.currentTier}`)}</small>
        </article>
        <article className="member-hub-card">
          <h2>{t("歷史累積點數")}</h2>
          <p className="member-tier-name">{stats.lifetimeEarnedPoints}</p>
          <small>{t("階級升級使用 lifetime_earned_points，不會因未來兌換而降低。")}</small>
        </article>
      </div>

      <div className="member-points-grid member-tier-grid">
        <article className="member-hub-card">
          <h2>{t("最高到達階級")}</h2>
          <p>{getTierLabel(stats.highestTier)}</p>
          <small>{t(`tier key：${stats.highestTier}`)}</small>
        </article>
        <article className="member-hub-card">
          <h2>{t("最低保護階級")}</h2>
          <p>{getTierLabel(stats.minimumTier)}</p>
          <small>{t("有效消費達 2,000 後，未來最低保護階級會是商人。")}</small>
        </article>
        <article className="member-hub-card">
          <h2>{t("有效消費累積")}</h2>
          <p>NT$ {profile.total_valid_spend.toLocaleString("zh-TW")}</p>
          <small>{t(`最近有效購買：${formatDateTime(profile.last_valid_purchase_at)}`)}</small>
        </article>
      </div>

      <div className="member-hub-grid">
        <article className="member-hub-card">
          <h2>{t("每日簽到")}</h2>
          <p>{stats.dailyClaimedToday ? t("今天已完成簽到。") : t("今天還沒簽到，可以領取 +2 點。")}</p>
          <button className="btn" type="button" disabled={busy || stats.dailyClaimedToday} onClick={claimDailyCheckin}>
            {busy ? t("簽到中...") : stats.dailyClaimedToday ? t("今日已簽到") : t("每日簽到 +2")}
          </button>
        </article>
        <article className="member-hub-card">
          <h2>{t("連續簽到 7 天")}</h2>
          <p>{t(`目前連續 ${Math.min(stats.streakDays, 7)} / 7 天。連續 7 天可額外獲得 +5 點。`)}</p>
          <div className="member-streak-meter" aria-label={t("連續簽到進度")}>
            <span style={{ width: `${Math.min(stats.streakDays, 7) / 7 * 100}%` }} />
          </div>
        </article>
        <article className="member-hub-card">
          <h2>{t("下一階級")}</h2>
          {tierProgress ? (
            <p>{t(`下一階級：${getTierLabel(tierProgress.nextTier)}，目前 ${tierProgress.current.toLocaleString("zh-TW")} / ${tierProgress.target.toLocaleString("zh-TW")}。`)}</p>
          ) : (
            <p>{t("目前已達自動升級範圍的最高階級；皇親以上為 manual-only，後續階段再規劃。")}</p>
          )}
        </article>
      </div>

      <div className="member-hub-grid">
        <article className="member-hub-card">
          <h2>{t("點數紀錄")}</h2>
          {latestRecords.length ? (
            <ul className="point-records">
              {latestRecords.map((record) => (
                <li key={record.id}>
                  <span>{t(record.note || sourceLabel(record.source_type))}</span>
                  <strong>{record.amount > 0 ? `+${record.amount}` : record.amount}</strong>
                  <small>{formatDateTime(record.created_at)} · {t(`餘額 ${record.balance_after}`)}</small>
                </li>
              ))}
            </ul>
          ) : (
            <p>{t("目前還沒有點數紀錄。完成每日簽到後，這裡會出現 ledger 紀錄。")}</p>
          )}
        </article>
        <article className="member-hub-card">
          <h2>{t("階級設定")}</h2>
          <ul className="member-tier-list">
            {tierSettings.map((tier) => (
              <li key={tier.tier_key}>
                <span>{tier.tier_name}</span>
                <small>{tier.is_manual_only ? t("手動授權") : t("自動判定")}</small>
              </li>
            ))}
          </ul>
        </article>
        <article className="member-hub-card">
          <h2>{t("站內入口")}</h2>
          <p>{t("你可以繼續看 AI 情報、工具與文章；商城購買與解鎖仍暫未開放。")}</p>
          <div className="member-hub-links">
            <Link href="/member/orders">{t("我的訂單")}</Link>
            <Link href="/news">{t("AI 情報")}</Link>
            <Link href="/tools">{t("AI 工具")}</Link>
            <Link href="/articles">{t("學習文章")}</Link>
          </div>
        </article>
      </div>

      <div className="member-hub-card member-future-card">
        <div>
          <span className="tag">FUTURE FEATURES</span>
          <h2>{t("平民階級未來功能")}</h2>
          <p>{t("以下功能本階段不建立資料表、不建立 API，也不提供正式操作；全部標記為暫未開放。")}</p>
        </div>
        <div className="member-future-grid">
          {futureFeatures.map((feature) => (
            <article key={feature.title}>
              <strong>{t(feature.title)}</strong>
              <span>{t("⬜ 暫未開放，後續階段再做。")}</span>
              <p>{t(feature.body)}</p>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
