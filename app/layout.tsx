import type { Metadata } from "next";
import { SiteShell } from "@/components/site-shell";
import "./globals.css";
import "./legacy.css";

export const metadata: Metadata = {
  title: "重啟實驗室｜James AI Build Log",
  description: "詹棋庭 James 的 AI 工具、學習文章、創作紀錄、AI 情報與個人品牌入口。",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
