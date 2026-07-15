import Link from "next/link";

export default function HomePage() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
      <p className="font-bold tracking-[0.2em] text-[var(--accent)]">JAMES AI BUILD LOG</p>
      <div className="mt-6 max-w-3xl">
        <h1 className="text-4xl font-black leading-tight sm:text-6xl">用 AI，把資訊變成可以行動的方向。</h1>
        <p className="mt-6 text-lg leading-8 text-[var(--muted)]">
          重啟實驗室 AI 資訊平台，整理 AI 新聞、研究、產品發布與技術更新，讓每則資訊都能回到實際使用。
        </p>
        <Link href="/news" className="mt-8 inline-flex rounded-lg bg-[var(--accent)] px-5 py-3 font-bold text-white hover:bg-[var(--accent-dark)]">
          查看最新 AI 情報 →
        </Link>
      </div>
      <div className="mt-16 grid gap-4 md:grid-cols-3">
        {[
          ["最新消息", "收集已審核與已發布的 AI 情報。"],
          ["清楚來源", "保留來源、分類、標籤與發布時間。"],
          ["持續建設", "後續接上會員、管理後台與自動化流程。"]
        ].map(([title, description]) => (
          <div key={title} className="rounded-2xl border border-[var(--line)] bg-white p-6">
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="mt-3 text-[var(--muted)]">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
