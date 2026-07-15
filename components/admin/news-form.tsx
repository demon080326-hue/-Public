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
        setError(`API 錯誤：伺服器回傳非 JSON 資料（HTTP ${response.status}）。`);
        return;
      }

      if (!response.ok || !result.id || result.ok !== true) {
        setError(formatApiError(result));
        return;
      }

      setSuccess({ id: result.id });
      event.currentTarget.reset();
    } catch {
      setError("無法連線到新增 API，請確認本機開發伺服器仍在運行。");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (success) {
    return (
      <div className="rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-black text-[var(--accent-dark)]">新增成功</h2>
        <p className="mt-3 text-[var(--muted)]">AI 情報已寫入 Supabase，前台重新整理後即可看到。</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link className="rounded-lg bg-[var(--accent)] px-4 py-2 font-bold text-white" href="/news">
            查看前台 AI 情報列表
          </Link>
          <Link className="rounded-lg border border-[var(--line)] px-4 py-2 font-bold" href={`/news/${success.id}`}>
            查看剛新增的文章
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form className="space-y-5 rounded-2xl border border-[var(--line)] bg-white p-6 shadow-sm" onSubmit={handleSubmit}>
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
        此後台目前僅限本機開發使用；正式部署前需要加入登入驗證。
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
        內文
        <textarea className="mt-2 min-h-56 w-full rounded-lg border border-[var(--line)] px-3 py-2" name="content" required maxLength={20000} />
      </label>

      <div className="grid gap-5 sm:grid-cols-2">
        <label className="block font-bold">
          分類
          <input className="mt-2 w-full rounded-lg border border-[var(--line)] px-3 py-2" name="category" defaultValue="AI 平台" maxLength={100} />
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

      <p className="text-sm text-[var(--muted)]">目前資料表沒有發布狀態欄位；送出後會立即發布並顯示在前台。原始來源網址在資料表中必須是唯一值。</p>

      {error ? <pre className="whitespace-pre-wrap rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</pre> : null}

      <button className="rounded-lg bg-[var(--accent)] px-5 py-3 font-bold text-white disabled:cursor-not-allowed disabled:opacity-60" type="submit" disabled={isSubmitting}>
        {isSubmitting ? "新增中..." : "新增 AI 情報"}
      </button>
    </form>
  );
}
