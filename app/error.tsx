"use client";

export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16">
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
        <h1 className="text-xl font-bold">頁面暫時無法載入</h1>
        <p className="mt-2 text-red-900">請稍後再試，或確認 Supabase 環境變數與資料庫連線。</p>
        <button className="mt-5 rounded-lg bg-[var(--accent)] px-4 py-2 font-bold text-white" onClick={reset}>
          重新載入
        </button>
      </div>
    </section>
  );
}
