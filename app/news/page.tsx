import { NewsCard } from "@/components/news-card";
import { getPublishedNews } from "@/lib/news";
import type { NewsItem } from "@/types/database";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  let news: NewsItem[] = [];
  let errorMessage = "";

  try {
    news = await getPublishedNews();
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : "讀取 AI 情報時發生未知錯誤。";
  }

  return (
    <section className="news-page">
      <div className="news-container">
        <div className="news-heading">
          <div className="news-heading-copy">
            <p className="news-eyebrow">AI INFORMATION CENTER</p>
            <h1>AI 情報中心</h1>
            <p className="news-intro">收集 AI 產品發布、研究論文、工具更新、技術趨勢與重大消息。</p>
          </div>
          <span className="news-count">共 {news.length} 則</span>
        </div>

        {errorMessage ? (
          <div className="news-message news-message-error">
            <h2>AI 情報暫時無法載入</h2>
            <p>{errorMessage}</p>
          </div>
        ) : news.length === 0 ? (
          <div className="news-message">
            <h2>目前尚無 AI 情報，請稍後再回來查看。</h2>
          </div>
        ) : (
          <div className="news-grid">
            {news.map((item) => (
              <NewsCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
