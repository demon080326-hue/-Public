import { NewsCard } from "@/components/news-card";
import { getPublishedNews } from "@/lib/news";
import type { NewsItem } from "@/types/database";

export default async function NewsPage() {
  let news: NewsItem[] = [];
  let errorMessage = "";

  try {
    news = await getPublishedNews();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "讀取 AI 情報時發生未知錯誤。";
  }

  return (
    <section className="mx-auto max-w-6xl px-5 py-12 sm:py-16">
      <p className="font-bold tracking-[0.2em] text-[var(--accent)]">AI INFORMATION CENTER</p>
      <div className="mt-4 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <h1 className="text-4xl font-black">AI 情報中心</h1>
          <p className="mt-3 text-[var(--muted)]">收集 AI 產品發布、研究論文、工具更新、技術趨勢與重大消息。</p>
        </div>
        <span className="text-sm text-[var(--muted)]">共 {news.length} 則</span>
      </div>

      {errorMessage ? (
        <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-8 text-red-900">
          <h2 className="text-xl font-bold">AI 情報暫時無法載入</h2>
          <p className="mt-3 break-words text-sm">{errorMessage}</p>
        </div>
      ) : news.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-[var(--line)] bg-white p-10 text-center">
          <h2 className="text-xl font-bold">目前尚無 AI 情報，請稍後再回來查看。</h2>
        </div>
      ) : (
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {news.map((item) => (
            <NewsCard key={item.id} item={item} />
          ))}
        </div>
      )}
    </section>
  );
}
