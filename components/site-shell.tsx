"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { LegacyRuntime } from "@/components/legacy-runtime";
import { SiteLanguage, translateSiteText } from "@/lib/site-language";

const menuGroups = [
  {
    title: "主要頁面",
    links: [
      ["首頁", "/"], ["關於我", "/about"], ["工具", "/tools"], ["文章", "/articles"],
      ["購買清單", "/shop"], ["聯絡我", "/contact"], ["AI 情報中心", "/news"],
    ],
  },
  {
    title: "會員與管理",
    links: [["會員登入", "/login"], ["下載", "/downloads"], ["管理系統", "/dashboard"]],
  },
] as const;

const footerLinks = [
  ["首頁", "/"], ["AI 情報中心", "/news"], ["關於我", "/about"], ["工具", "/tools"],
  ["文章", "/articles"], ["購買清單", "/shop"], ["聯絡我", "/contact"],
] as const;

const knowledge = [
  { title: "AI 工具", href: "/tools", keywords: "工具 Claude ChatGPT Cursor 推薦", description: "查看 James 整理與製作的 AI 工具。" },
  { title: "AI 情報中心", href: "/news", keywords: "情報 新聞 OpenAI 模型 DeepMind Hugging Face", description: "追蹤最新 AI 產品、模型與研究消息。" },
  { title: "學習文章", href: "/articles", keywords: "文章 教學 Prompt Agent 新手", description: "閱讀 AI 教學、Prompt 與實作筆記。" },
  { title: "購買清單", href: "/shop", keywords: "購買 筆電 設備 RTX", description: "查看 AI 筆電與創作設備整理。" },
  { title: "聯絡 James", href: "/contact", keywords: "聯絡 Email Instagram 合作", description: "取得 Email、Instagram 與合作方式。" },
  { title: "會員登入", href: "/login", keywords: "會員 登入 下載", description: "進入 James AI Club 會員 MVP。" },
];

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [language, setLanguage] = useState<SiteLanguage>("zh-Hant");
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState("歡迎來到重啟實驗室！我可以幫你找 AI 工具、教學文章、AI 情報與聯絡方式。");
  const [results, setResults] = useState(knowledge.slice(0, 3));
  const t = (text: string) => translateSiteText(text, language);

  useEffect(() => {
    const saved = localStorage.getItem("james-site-language") as SiteLanguage | null;
    const loadSavedLanguage = window.setTimeout(() => {
      if (saved === "zh-Hant" || saved === "en" || saved === "ja") setLanguage(saved);
    }, 0);
    return () => window.clearTimeout(loadSavedLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem("james-site-language", language);
  }, [language]);

  useEffect(() => {
    const closeOverlays = window.setTimeout(() => {
      setMenuOpen(false);
      setAssistantOpen(false);
    }, 0);
    return () => window.clearTimeout(closeOverlays);
  }, [pathname]);

  useEffect(() => {
    document.body.classList.toggle("menu-open", menuOpen);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setAssistantOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.classList.remove("menu-open");
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const quickQuestions = useMemo(() => ["AI 新手入門", "推薦 AI 工具", "AI 教學文章", "聯絡 James"], []);

  function searchAssistant(value: string) {
    const keyword = value.trim().toLowerCase();
    const matches = keyword
      ? knowledge.filter((item) => `${item.title} ${item.keywords} ${item.description}`.toLowerCase().includes(keyword))
      : knowledge.slice(0, 3);
    setResults(matches);
    setAnswer(matches.length ? `找到 ${matches.length} 個相關入口，你可以直接點選。` : "目前沒有完全符合的結果，可以試試「AI 工具」、「情報」、「文章」或「聯絡」。");
  }

  function submitAssistant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    searchAssistant(query);
  }

  function askQuick(question: string) {
    setQuery(question);
    searchAssistant(question.replace("新手入門", "文章 教學").replace("推薦 ", ""));
  }

  return (
    <>
      <header className="site-header">
        <nav className="nav" aria-label="主選單">
          <Link className="brand site-brand" href="/" aria-label="回到首頁">
            <span className="mark">
              <Image className="site-brand-avatar" src="/assets/images/avatar.jpg" alt="James" width={38} height={38} priority />
            </span>
            <span className="site-brand-copy"><strong>{t("重啟實驗室")}</strong><small>James AI Build Log</small></span>
          </Link>
          <div className="language-switcher">
            <span>語言</span>
            <select className="language-select" aria-label="語言 / Language" value={language} onChange={(event) => setLanguage(event.target.value as SiteLanguage)}>
              <option value="zh-Hant">繁中</option>
              <option value="en">English</option>
              <option value="ja">日本語</option>
            </select>
          </div>
          <button className="menu-toggle" type="button" aria-label="開啟網站選單" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}>
            <span /><span /><span />
          </button>
        </nav>
      </header>

      <main id="main-content">{children}</main>

      <footer className="footer">
        <div className="wrap">
          <span>&copy; 2026 詹姆士｜James · 重啟實驗室 · 高雄</span>
          <div className="footer-links">
            {footerLinks.map(([label, href]) => <Link key={href} href={href}>{t(label)}</Link>)}
          </div>
        </div>
      </footer>

      <button className="menu-backdrop" aria-label="關閉網站選單" onClick={() => setMenuOpen(false)} />
      <aside className="site-menu" aria-label="網站總選單" aria-hidden={!menuOpen}>
        <div className="site-menu-head">
          <div><strong>{t("網站總選單")}</strong><span>{t("先選大分類，再進小頁面")}</span></div>
          <button className="menu-close" type="button" aria-label="關閉選單" onClick={() => setMenuOpen(false)}>×</button>
        </div>
        <div className="site-menu-body">
          {menuGroups.map((group, index) => (
            <details className="menu-group" open={index === 0 ? true : undefined} key={group.title}>
              <summary>{t(group.title)}</summary>
              {group.links.map(([label, href]) => <Link className={pathname === href ? "active" : ""} href={href} key={href} onClick={() => setMenuOpen(false)}>{t(label)}</Link>)}
            </details>
          ))}
        </div>
      </aside>

      <div className={`ai-helper has-reminder${assistantOpen ? " open" : ""}`}>
        <div className="ai-panel" role="dialog" aria-label="AI 客服小幫手" aria-hidden={!assistantOpen}>
          <div className="ai-panel-head">
            <div className="ai-panel-title-row">
              <div><h2>{t("AI 客服小幫手")}</h2><p className="ai-note">{answer}</p></div>
              <button className="ai-panel-close" type="button" aria-label="收合 AI 客服" onClick={() => setAssistantOpen(false)}>×</button>
            </div>
          </div>
          <div className="ai-panel-scroll">
            <div className="ai-quick">
              {quickQuestions.map((question) => <button type="button" key={question} onClick={() => askQuick(question)}>{t(question)}</button>)}
            </div>
            <details className="ai-faq">
              <summary>{t("常見問題")}</summary>
              <button type="button" onClick={() => askQuick("推薦 AI 工具")}>有哪些 AI 工具？</button>
              <button type="button" onClick={() => askQuick("AI 情報")}>如何查看最新 AI 情報？</button>
              <Link href="/contact">如何聯絡 James？</Link>
            </details>
            <div className="ai-results">
              {results.map((item) => <Link href={item.href} key={item.href} onClick={() => setAssistantOpen(false)}><strong>{item.title}</strong><span>{item.description}</span></Link>)}
            </div>
          </div>
          <form className="ai-chat-form" onSubmit={submitAssistant}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={t("問我：James 的 AI 工具、文章、情報或聯絡方式")} aria-label="詢問 AI 客服" />
            <button type="submit">{t("送出")}</button>
          </form>
        </div>
        <button className="ai-orb" type="button" aria-label="開啟 AI 小幫手" aria-expanded={assistantOpen} onClick={() => setAssistantOpen((open) => !open)}>
          <span className="ai-hover-greeting">{t("你好！有什麼需要幫忙的嗎？")}</span>
          <span className="ai-notice-badge">1</span>
          <img className="ai-orb-image" src="/assets/images/ai-helper-robot.png" alt="AI 客服機器人" />
        </button>
      </div>

      <LegacyRuntime language={language} />
    </>
  );
}
