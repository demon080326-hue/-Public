import { notFound } from "next/navigation";
import { getLegacyArticleHtml, getLegacyArticleSlugs } from "@/lib/legacy-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return getLegacyArticleSlugs().map((slug) => ({ slug }));
}

export default async function LegacyArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!getLegacyArticleSlugs().includes(slug)) notFound();
  return <div className="legacy-page" dangerouslySetInnerHTML={{ __html: getLegacyArticleHtml(slug) }} />;
}
