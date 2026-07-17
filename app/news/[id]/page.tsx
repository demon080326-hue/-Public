import Link from "next/link";
import { notFound } from "next/navigation";
import { getNewsById } from "@/lib/news";

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("zh-TW", { dateStyle: "full" }).format(new Date(value)) : "尚未提供日期";
}

function renderMarkdownLite(content: string) {
  return content
    .split(/\r?\n/)
    .map((line, index) => {
      const key = `${index}-${line}`;
      const trimmed = line.trim();

      if (!trimmed) return <div key={key} className="h-3" />;
      if (trimmed.startsWith("# ")) return <h2 key={key}>{trimmed.slice(2)}</h2>;
      if (trimmed.startsWith("## ")) return <h3 key={key}>{trimmed.slice(3)}</h3>;
      if (trimmed.startsWith("- ")) return <p key={key}>• {trimmed.slice(2)}</p>;

      return <p key={key}>{trimmed}</p>;
    });
}

export default async function NewsDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const item = await getNewsById(id);

  if (!item) notFound();

  return (
    <article className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
      <Link href="/news" className="text-sm font-bold text-[var(--accent)]">
        ← 返回 AI 情報
      </Link>
      <div className="mt-8 border-b border-[var(--line)] pb-8">
        <div className="flex flex-wrap gap-3 text-sm text-[var(--muted)]">
          <span>{item.category}</span>
          <span>·</span>
          <span>{item.source_name}</span>
          <span>·</span>
          <time dateTime={item.published_at ?? undefined}>{formatDate(item.published_at)}</time>
          <span>·</span>
          <span>AI 分數：{item.importance_score}</span>
        </div>
        {item.tags.length ? (
          <div className="mt-4 flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <span key={tag} className="rounded-full bg-[#edf5f1] px-3 py-1 text-sm font-bold text-[var(--accent-dark)]">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
        <h1 className="mt-5 text-4xl font-black leading-tight sm:text-5xl">{item.title_zh}</h1>
        {item.title_original !== item.title_zh ? <p className="mt-3 text-lg text-[var(--muted)]">{item.title_original}</p> : null}
      </div>
      <div className="prose prose-lg mt-8 max-w-none leading-8">
        {item.summary_short ? (
          <>
            <h2>摘要</h2>
            <p>{item.summary_short}</p>
          </>
        ) : null}
        {item.why_it_matters ? (
          <>
            <h2>為什麼重要</h2>
            <p>{item.why_it_matters}</p>
          </>
        ) : null}
        {item.image_url ? <img className="my-8 w-full rounded-2xl border border-[var(--line)]" src={item.image_url} alt={item.title_zh} /> : null}
        {item.summary_full ? (
          <>
            <h2>內文</h2>
            <div>{renderMarkdownLite(item.summary_full)}</div>
          </>
        ) : null}
        {item.canonical_url || item.source_url ? (
          <p>
            <a className="font-bold text-[var(--accent)]" href={item.canonical_url ?? item.source_url} target="_blank" rel="noopener noreferrer">
              前往原始來源 →
            </a>
          </p>
        ) : null}
      </div>
    </article>
  );
}
