import { getLegacyPageHtml } from "@/lib/legacy-content";

export function LegacyPage({ fileName }: { fileName: string }) {
  return <div className="legacy-page" suppressHydrationWarning dangerouslySetInnerHTML={{ __html: getLegacyPageHtml(fileName) }} />;
}
