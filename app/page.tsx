import { HomeMotion } from "@/components/motion/home-motion";
import { HomeV2Preview } from "@/components/home-v2-preview";
import { LegacyPage } from "@/components/legacy-page";

export default async function HomePage() {
  return <>
    <HomeMotion />
    <LegacyPage fileName="index.html" />
    <HomeV2Preview />
  </>;
}
