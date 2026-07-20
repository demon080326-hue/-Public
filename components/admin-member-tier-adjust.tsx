"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  canActorAssignTier,
  getAdminTierOptions,
  getTierLabel,
  getTierOrder,
} from "@/lib/member-tier";
import type { MemberRole, MemberTierKey } from "@/types/database";

type ApiResponse = {
  ok?: boolean;
  code?: string;
  message?: string;
  beforeTier?: MemberTierKey;
  afterTier?: MemberTierKey;
  highestTier?: MemberTierKey;
};

type AdminMemberTierAdjustProps = {
  memberId: string;
  currentTier: MemberTierKey;
  highestTier: MemberTierKey;
  minimumTier: MemberTierKey;
  actorRole: MemberRole;
};

export function AdminMemberTierAdjust({
  memberId,
  currentTier,
  highestTier,
  minimumTier,
  actorRole,
}: AdminMemberTierAdjustProps) {
  const router = useRouter();
  const options = useMemo(() => getAdminTierOptions(), []);
  const [targetTier, setTargetTier] = useState<MemberTierKey>(currentTier);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const reasonLength = reason.trim().length;
  const isSameTier = targetTier === currentTier;
  const allowedForActor = canActorAssignTier(actorRole, targetTier);
  const willRaiseHighest = getTierOrder(targetTier) > getTierOrder(highestTier);
  const canSubmit =
    !isSameTier && allowedForActor && reasonLength >= 5 && reasonLength <= 300 && !submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!canSubmit) {
      setMessage({
        kind: "error",
        text: isSameTier
          ? "目標階級與目前階級相同，請重新選擇。"
          : !allowedForActor
            ? "只有 owner 可以設定皇室親屬、皇室直系或國王階級。"
            : "請確認目標階級與原因格式正確。",
      });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}/tier-adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetTier, reason: reason.trim() }),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(data.message || "階級調整失敗，請稍後再試。");
      }

      setReason("");
      setMessage({
        kind: "success",
        text: `調整成功：${getTierLabel(data.beforeTier ?? currentTier)} → ${getTierLabel(data.afterTier ?? targetTier)}（最高階級：${getTierLabel(data.highestTier ?? highestTier)}）。`,
      });
      router.refresh();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "階級調整失敗，請稍後再試。" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="cms-panel admin-points-adjust-panel admin-tier-adjust-panel">
      <div className="cms-library-head">
        <div><p className="eyebrow">Tier adjustment</p><h2>手動調整會員階級</h2></div>
        <span className="cms-pill">{actorRole === "owner" ? "Owner 專用" : "管理員專用"}</span>
      </div>
      <p className="cms-help">此操作會修改會員目前階級，並永久寫入階級紀錄與後台操作紀錄。</p>

      <form className="admin-points-adjust-form" onSubmit={handleSubmit}>
        <label>
          目標階級
          <select
            className="form-input"
            value={targetTier}
            onChange={(event) => setTargetTier(event.target.value as MemberTierKey)}
            disabled={submitting}
          >
            {options.map((option) => {
              const locked = !canActorAssignTier(actorRole, option.key);
              return (
                <option key={option.key} value={option.key} disabled={locked}>
                  {option.label}（{option.key}）{option.ownerOnly ? "・皇室" : ""}{locked ? "・限 owner" : ""}
                </option>
              );
            })}
          </select>
          <small>一般階級 owner／admin 皆可調整；皇室親屬、皇室直系、國王僅限 owner。</small>
        </label>

        <label>
          調整原因
          <textarea
            rows={4}
            minLength={5}
            maxLength={300}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            disabled={submitting}
            required
          />
          <small>{reasonLength}/300 字，至少 5 字。</small>
        </label>

        <div className={`admin-points-preview${isSameTier || !allowedForActor ? " is-invalid" : ""}`} aria-live="polite">
          <span>目前階級 <strong>{getTierLabel(currentTier)}</strong></span>
          <span>調整後 <strong>{getTierLabel(targetTier)}</strong></span>
        </div>

        <ul className="admin-points-warnings">
          <li>最高階級（highest_tier）{willRaiseHighest ? "會往上更新為 " + getTierLabel(targetTier) : "不會改變（只升不降）"}。</li>
          <li>目前最高階級：{getTierLabel(highestTier)}；最低保障階級：{getTierLabel(minimumTier)}（不會改變）。</li>
          <li>本階段只調整會員階級，不會調整點數、不會調整 lifetime、不會處理購買紀錄。</li>
          <li>points_balance 不會改變、lifetime_earned_points 不會改變、minimum_tier 不會改變。</li>
          <li>本操作不能刪除紀錄，且會寫入 audit log。</li>
        </ul>

        {message ? <p className={`admin-points-message ${message.kind}`} role="status">{message.text}</p> : null}
        <button className="btn" type="submit" disabled={!canSubmit}>{submitting ? "處理中..." : "確認調整階級"}</button>
      </form>
    </section>
  );
}
