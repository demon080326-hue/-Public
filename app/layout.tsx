import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "重啟實驗室 AI 資訊平台",
  description: "整理 AI 新聞、研究、產品發布與實作更新。"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant">
      <body>
        <header className="border-b border-[var(--line)] bg-white">
          <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
            <Link href="/" className="font-bold tracking-wide">
              重啟實驗室 <span className="font-normal text-[var(--muted)]">/ James AI Build Log</span>
            </Link>
            <nav className="flex gap-4 text-sm text-[var(--muted)]" aria-label="主要導覽">
              <Link className="hover:text-[var(--accent)]" href="/">首頁</Link>
              <Link className="hover:text-[var(--accent)]" href="/news">AI 情報</Link>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="border-t border-[var(--line)] bg-white">
          <div className="mx-auto max-w-6xl px-5 py-6 text-sm text-[var(--muted)]">
            © {new Date().getFullYear()} 重啟實驗室 / James AI Build Log
          </div>
        </footer>
      </body>
    </html>
  );
}
