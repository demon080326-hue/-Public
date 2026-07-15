import Link from "next/link";
import type { NewsItem } from "@/types/database";

function formatDate(value: string | null) {
  if (!value) return "尚未提供日期";
  return new Intl.DateTimeFormat("zh-TW", { dateStyle: "medium" }).format(new Date(value));
}

export function NewsCard({ item }: { item: NewsItem }) {
  return (
    <article className="flex h-full flex-col rounded-2xl border border-[var(--line)] bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-xs text-[var(--muted)]">
        <span>{item.category}</span>
        <time dateTime={item.published_at ?? undefined}>{formatDate(item.published_at)}</time>
      </div>
      <h2 className="mt-4 text-xl font-bold leading-snug">{item.title_zh}</h2>
      {item.summary_short ? <p className="mt-3 line-clamp-3 text-[var(--muted)]">{item.summary_short}</p> : null}
      <p className="mt-3 text-sm text-[var(--muted)]">來源：{item.source_name}</p>
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        {item.tags.slice(0, 4).map((tag) => (
          <span key={tag} className="rounded-full bg-[#edf5f1] px-2.5 py-1 text-xs text-[var(--accent-dark)]">
            #{tag}
          </span>
        ))}
      </div>
      <Link href={`/news/${item.id}`} className="mt-5 font-bold text-[var(--accent)] hover:text-[var(--accent-dark)]">
        閱讀全文 →
      </Link>
    </article>
  );
}
