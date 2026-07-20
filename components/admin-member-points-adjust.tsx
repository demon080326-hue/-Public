"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

type AdjustmentType = "add" | "deduct";

type ApiResponse = {
  ok?: boolean;
  message?: string;
  beforePoints?: number;
  afterPoints?: number;
  delta?: number;
};

export function AdminMemberPointsAdjust({ memberId, currentPoints }: { memberId: string; currentPoints: number }) {
  const router = useRouter();
  const [type, setType] = useState<AdjustmentType>("add");
  const [points, setPoints] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const parsedPoints = points === "" ? null : Number(points);
  const validPoints = parsedPoints !== null && Number.isInteger(parsedPoints) && parsedPoints >= 1 && parsedPoints <= 10000;
  const afterPoints = useMemo(() => {
    if (!validPoints || parsedPoints === null) return currentPoints;
    return type === "add" ? currentPoints + parsedPoints : currentPoints - parsedPoints;
  }, [currentPoints, parsedPoints, type, validPoints]);
  const reasonLength = reason.trim().length;
  const wouldBeNegative = type === "deduct" && afterPoints < 0;
  const canSubmit = validPoints && reasonLength >= 5 && reasonLength <= 300 && !wouldBeNegative && !submitting;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);

    if (!canSubmit || parsedPoints === null) {
      setMessage({ kind: "error", text: wouldBeNegative ? "扣點後不可低於 0 點。" : "請確認點數與原因格式正確。" });
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/members/${encodeURIComponent(memberId)}/points-adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, points: parsedPoints, reason: reason.trim() }),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(data.message || "點數調整失敗，請稍後再試。");
      }

      setPoints("");
      setReason("");
      setMessage({
        kind: "success",
        text: `調整成功：${data.beforePoints ?? currentPoints} 點 → ${data.afterPoints ?? afterPoints} 點。`,
      });
      router.refresh();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "點數調整失敗，請稍後再試。" });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="cms-panel admin-points-adjust-panel">
      <div className="cms-library-head">
        <div><p className="eyebrow">Points adjustment</p><h2>手動調整點數</h2></div>
        <span className="cms-pill">管理員專用</span>
      </div>
      <p className="cms-help">此操作會直接修改會員可用點數，並永久寫入點數紀錄與後台操作紀錄。</p>

      <form className="admin-points-adjust-form" onSubmit={handleSubmit}>
        <fieldset disabled={submitting}>
          <legend>操作類型</legend>
          <div className="admin-points-type-options">
            <label><input type="radio" name="adjustment-type" value="add" checked={type === "add"} onChange={() => setType("add")} /> 加點</label>
            <label><input type="radio" name="adjustment-type" value="deduct" checked={type === "deduct"} onChange={() => setType("deduct")} /> 扣點</label>
          </div>
        </fieldset>

        <label>
          點數數量
          <input
            type="number"
            min="1"
            max="10000"
            step="1"
            inputMode="numeric"
            value={points}
            onChange={(event) => setPoints(event.target.value)}
            disabled={submitting}
            required
          />
          <small>請輸入 1 到 10000 的正整數。</small>
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

        <div className={`admin-points-preview${wouldBeNegative ? " is-invalid" : ""}`} aria-live="polite">
          <span>目前點數 <strong>{currentPoints.toLocaleString("zh-TW")}</strong></span>
          <span>調整後 <strong>{afterPoints.toLocaleString("zh-TW")}</strong></span>
        </div>

        <ul className="admin-points-warnings">
          <li>本階段只調整可用點數，不會自動調整會員階級。</li>
          <li>本操作不能刪除紀錄。</li>
          <li>本操作會寫入 audit log。</li>
        </ul>

        {message ? <p className={`admin-points-message ${message.kind}`} role="status">{message.text}</p> : null}
        <button className="btn" type="submit" disabled={!canSubmit}>{submitting ? "處理中..." : type === "add" ? "確認加點" : "確認扣點"}</button>
      </form>
    </section>
  );
}
