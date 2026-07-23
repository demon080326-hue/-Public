import Link from "next/link";
import { notFound } from "next/navigation";
import { NewsImage } from "@/components/news-image";
import { getNewsById } from "@/lib/news";
import {
  buildNewsHighlights,
  buildNewsReadingSummary,
  buildWhyItMatters,
} from "@/lib/news-reading";

function formatDate(value: string | null) {
  return value
    ? new Intl.DateTimeFormat("zh-TW", {
        dateStyle: "full",
        timeZone: "Asia/Taipei",
      }).format(new Date(value))
    : "尚未提供日期";
}

function renderMarkdownLite(content: string) {
  return content
    .split(/\r?\n/)
    .map((line, index) => {
      const key = `${index}-${line}`;
      const trimmed = line.trim();

      if (!trimmed) return <div key={key} className="news-detail-spacer" />;
      if (trimmed.startsWith("# ")) return <h2 key={key}>{trimmed.slice(2)}</h2>;
      if (trimmed.startsWith("## ")) return <h3 key={key}>{trimmed.slice(3)}</h3>;
      if (trimmed.startsWith("- ")) return <p key={key} className="news-detail-list-line">• {trimmed.slice(2)}</p>;

      return <p key={key}>{trimmed}</p>;
    });
}

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getNewsById(id);

  if (!item) notFound();

  const highlights = buildNewsHighlights(item);
  const readingSummary = buildNewsReadingSummary(item);
  const whyItMatters = buildWhyItMatters(item);

  return (
    <section className="news-detail-page">
      <article className="news-detail-shell">
        <Link href="/news" className="news-detail-back">
          ← 返回 AI 情報
        </Link>

        <header className="news-detail-header">
          <div className="news-detail-meta">
            <span>{item.category}</span>
            <span aria-hidden="true">·</span>
            <span>{item.source_name}</span>
            <span aria-hidden="true">·</span>
            <time dateTime={item.published_at ?? undefined}>{formatDate(item.published_at)}</time>
            <span aria-hidden="true">·</span>
            <span>AI 分數：{item.importance_score}</span>
          </div>
          {item.tags.length ? (
            <div className="news-detail-tags" aria-label="文章標籤">
              {item.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          ) : null}
          <h1>{item.title_zh}</h1>
          {item.title_original !== item.title_zh ? (
            <p className="news-detail-original-title">原始標題：{item.title_original}</p>
          ) : null}
          {item.summary_short ? (
            <div className="news-detail-lead">
              <strong>一句話摘要</strong>
              <p>{item.summary_short}</p>
            </div>
          ) : null}
        </header>

        <NewsImage src={item.image_url} alt={item.title_zh} variant="detail" />

        <div className="news-detail-sections">
          <section className="news-detail-highlight">
            <p className="news-detail-kicker">KEY TAKEAWAYS</p>
            <h2>重點整理</h2>
            <ul>
              {highlights.map((highlight) => (
                <li key={highlight}>{highlight}</li>
              ))}
            </ul>
          </section>

          <section>
            <h2>這篇大概在講什麼</h2>
            <p>{readingSummary}</p>
          </section>

          <section>
            <h2>為什麼值得關注</h2>
            <p>{whyItMatters}</p>
          </section>

          {item.summary_full ? (
            <section>
              <h2>內文整理</h2>
              <div className="news-detail-content">{renderMarkdownLite(item.summary_full)}</div>
            </section>
          ) : null}

          {item.canonical_url || item.source_url ? (
            <section className="news-detail-source">
              <h2>原始來源</h2>
              <a href={item.canonical_url ?? item.source_url} target="_blank" rel="noopener noreferrer">
                前往 {item.source_name} 查看完整內容 →
              </a>
            </section>
          ) : null}
        </div>
      </article>
    </section>
  );
}
