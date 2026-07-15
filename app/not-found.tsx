import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div className="max-w-xl rounded-2xl border border-[var(--line)] bg-white p-8">
        <p className="font-bold tracking-[0.2em] text-[var(--accent)]">404</p>
        <h1 className="mt-4 text-3xl font-black">找不到這則 AI 情報</h1>
        <p className="mt-3 text-[var(--muted)]">文章可能尚未發布、已下架，或網址已經更新。</p>
        <Link href="/news" className="mt-6 inline-flex rounded-lg bg-[var(--accent)] px-4 py-2 font-bold text-white">
          回到 AI 情報
        </Link>
      </div>
    </section>
  );
}
