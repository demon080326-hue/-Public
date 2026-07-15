import Link from "next/link";
import { NewsForm } from "@/components/admin/news-form";

export default function NewNewsPage() {
  return (
    <section className="mx-auto max-w-3xl px-5 py-12 sm:py-16">
      <Link href="/news" className="text-sm font-bold text-[var(--accent)]">
        ← 返回 AI 情報
      </Link>
      <p className="mt-8 font-bold tracking-[0.2em] text-[var(--accent)]">ADMIN</p>
      <h1 className="mt-3 text-4xl font-black">新增 AI 情報</h1>
      <p className="mt-3 text-[var(--muted)]">填寫完成後，資料會寫入 Supabase 的 ai_news 資料表。</p>
      <div className="mt-8">
        <NewsForm />
      </div>
    </section>
  );
}
