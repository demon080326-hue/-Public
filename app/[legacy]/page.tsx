import { notFound } from "next/navigation";
import { LegacyPage } from "@/components/legacy-page";
import { legacyRootPages } from "@/lib/legacy-content";

export const dynamicParams = false;

export function generateStaticParams() {
  return legacyRootPages.map((legacy) => ({ legacy }));
}

export default async function LegacyRootPage({ params }: { params: Promise<{ legacy: string }> }) {
  const { legacy } = await params;
  if (!(legacyRootPages as readonly string[]).includes(legacy)) notFound();
  return <LegacyPage fileName={`${legacy}.html`} />;
}
