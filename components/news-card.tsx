import Link from "next/link";
import type { NewsItem } from "@/types/database";

function formatDate(value: string | null) {
  if (!value) return "尚未提供日期";
  return new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(new Date(value));
}

export function NewsCard({ item }: { item: NewsItem }) {
  const scoreLabel = item.importance_score >= 90 ? "重大消息" : item.importance_score >= 80 ? "重點情報" : "";

  return (
    <article className="news-card">
      <div className="news-card-top">
        <div className="news-card-category-row">
          <span className="news-card-category">{item.category}</span>
          {scoreLabel ? <span className="news-card-score-label">{scoreLabel}</span> : null}
        </div>
        <time dateTime={item.published_at ?? undefined}>{formatDate(item.published_at)}</time>
      </div>
      <h2 className="news-card-title">{item.title_zh}</h2>
      {item.summary_short ? <p className="news-card-summary">{item.summary_short}</p> : null}
      <div className="news-card-meta">
        <span>來源：{item.source_name}</span>
        {item.importance_score ? <span>AI 分數：{item.importance_score}</span> : null}
      </div>
      <div className="news-card-tags">
        {item.tags.slice(0, 4).map((tag) => (
          <span key={tag}>
            #{tag}
          </span>
        ))}
      </div>
      <Link href={`/news/${item.id}`} className="news-card-link">
        閱讀全文 →
      </Link>
    </article>
  );
}
