"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";

type Success = { id: string } | null;
type ApiResult = {
  ok?: boolean;
  id?: string;
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
};

function formatApiError(result: ApiResult) {
  const lines = [
    result.message ?? "新增失敗，請稍後再試。",
    result.details ? `Details: ${result.details}` : "",
    result.hint ? `Hint: ${result.hint}` : "",
    result.code ? `Code: ${result.code}` : "",
  ].filter(Boolean);

  return lines.join("\n");
}

export function NewsForm() {
  const [success, setSuccess] = useState<Success>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(null);
    setIsSubmitting(true);

    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());

    try {
      const response = await fetch("/api/admin/news", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let result: ApiResult = {};
      try {
        result = (await response.json()) as ApiResult;
      } catch {
        setError(`API 回應不是有效 JSON。HTTP ${response.status}`);
        return;
      }

      if (!response.ok || !result.id || result.ok !== true) {
        setError(formatApiError(result));
        return;
      }

      setSuccess({ id: result.id });
      event.currentTarget.reset();
    } catch {
      setError("無法連線到管理 API，請確認登入狀態與網路連線。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-black text-[var(--accent-dark)]">新增成功</h2>
        <p className="mt-3 text-[var(--muted)]">AI 情報已寫入 Supabase。你可以到前台列表與詳細頁確認顯示結果。</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-lg bg-[var(--accent)] px-4 py-2 font-bold text-white" href="/news">
            查看 AI 情報列表
          </Link>
          <Link className="rounded-lg border border-[var(--line)] px-4 py-2 font-bold" href={`/news/${success.id}`}>
            查看新增文章
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-5 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        此表單僅限 admin / owner 使用。Production 寫入目前仍維持安全關閉，避免誤改正式資料。
      </div>

      <label className="block font-bold">
        標題
        <input className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2" name="title" required maxLength={200} />
      </label>

      <label className="block font-bold">
        摘要
        <textarea className="mt-2 min-h-24 w-full rounded-lg border border-[var(--line)] px-3 py-2" name="summary" required maxLength={1000} />
      </label>

      <label className="block font-bold">
        內容
        <textarea className="mt-2 min-h-56 w-full rounded-lg border border-[var(--line)] px-3 py-2" name="content" required maxLength={20000} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block font-bold">
          分類
          <input className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2" name="category" defaultValue="AI 情報" maxLength={100} />
        </label>
        <label className="block font-bold">
          來源名稱
          <input className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2" name="source" defaultValue="Restart Lab" maxLength={200} />
        </label>
      </div>

      <label className="block font-bold">
        原始來源網址
        <input className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2" name="source_url" type="url" required placeholder="https://example.com/news" />
      </label>

      <label className="block font-bold">
        圖片網址（選填）
        <input className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2" name="image_url" type="url" placeholder="https://example.com/news-image.jpg" />
      </label>

      <p className="text-sm text-[var(--muted)]">
        tags 與 ai_score 暫由後端預設或後續流程處理；此表單只負責安全地送出 AI 情報基本欄位。
      </p>

      {error ? <pre className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</pre> : null}

      <button className="rounded-lg bg-[var(--accent)] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "新增中..." : "新增 AI 情報"}
      </button>
    </form>
  );
}
