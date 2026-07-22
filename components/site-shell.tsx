"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";
import { LegacyRuntime } from "@/components/legacy-runtime";
import { siteLanguageEvent } from "@/hooks/use-site-language";
import { SiteLanguage, translateSiteText } from "@/lib/site-language";

type KnowledgeItem = { title: string; href: string; keywords: string; description: string };
type ChatMessage = { role: "assistant" | "user"; text: string };

const languageCopy = {
  "zh-Hant": {
    language: "語言", home: "首頁", about: "關於我", tools: "工具", articles: "文章", shop: "購買清單", contact: "聯絡我", news: "AI 情報中心", login: "會員登入", downloads: "下載中心", admin: "管理系統", menu: "網站總選單", menuHint: "先選大分類，再進小頁面", mainPages: "主要頁面", memberPages: "會員與管理", openMenu: "開啟網站選單", closeMenu: "關閉網站選單", assistant: "AI 客服小幫手", openAssistant: "開啟 AI 小幫手", closeAssistant: "收合 AI 客服", prompt: "問我：工具、文章、AI 情報、會員或聯絡方式", send: "送出", clear: "清除", faq: "常見問題", quick: ["這個網站是什麼？", "推薦 AI 工具", "我要看 AI 情報", "聯絡 James"], noAnswer: "我目前還在學習中，你可以換個問法，或點選下方常見問題。", greeting: "你好！我是在網站內運作的前端小幫手，可以幫你找公開頁面與功能資訊。", greetingBubble: "你好！有什麼需要幫忙的嗎？", faqTools: "有哪些 AI 工具？", faqNews: "我要看最新 AI 情報", faqMember: "我要加入會員", faqStore: "AI 商城可以購買嗎？", faqContact: "怎麼聯絡 James？", footer: "© 2026 詹姆士｜James · 重啟實驗室 · 高雄",
  },
  en: {
    language: "Language", home: "Home", about: "About", tools: "Tools", articles: "Articles", shop: "Buying List", contact: "Contact", news: "AI News Center", login: "Member Login", downloads: "Downloads", admin: "Admin System", menu: "Site Menu", menuHint: "Choose a category, then open a page", mainPages: "Main Pages", memberPages: "Members & Admin", openMenu: "Open site menu", closeMenu: "Close menu", assistant: "AI Support Assistant", openAssistant: "Open AI assistant", closeAssistant: "Close AI assistant", prompt: "Ask about tools, articles, AI news, membership, or contact", send: "Send", clear: "Clear", faq: "FAQ", quick: ["What is this website?", "Recommend AI tools", "Show AI news", "Contact James"], noAnswer: "I am still learning. Please try another question or choose a FAQ below.", greeting: "Hi! I am an on-site assistant MVP. I can help you find public pages and site information.", greetingBubble: "Hi! How can I help?", faqTools: "What AI tools are available?", faqNews: "Show the latest AI news", faqMember: "How do I join?", faqStore: "Can I buy from the marketplace?", faqContact: "How can I contact James?", footer: "© 2026 James · Restart Lab · Kaohsiung",
  },
  ja: {
    language: "言語", home: "ホーム", about: "プロフィール", tools: "ツール", articles: "記事", shop: "購入リスト", contact: "お問い合わせ", news: "AI情報センター", login: "会員ログイン", downloads: "ダウンロード", admin: "管理システム", menu: "サイトメニュー", menuHint: "カテゴリを選んでページへ進みます", mainPages: "主要ページ", memberPages: "会員と管理", openMenu: "サイトメニューを開く", closeMenu: "メニューを閉じる", assistant: "AIサポートアシスタント", openAssistant: "AIアシスタントを開く", closeAssistant: "AIアシスタントを閉じる", prompt: "ツール、記事、AI情報、会員、連絡先について質問してください", send: "送信", clear: "クリア", faq: "よくある質問", quick: ["このサイトについて", "AIツールを推薦", "AI情報を見る", "Jamesに連絡"], noAnswer: "まだ学習中です。別の聞き方をするか、下のよくある質問を選んでください。", greeting: "こんにちは。これはサイト内で動くアシスタントMVPです。公開ページとサイト情報を案内できます。", greetingBubble: "こんにちは！何をお手伝いできますか？", faqTools: "AIツールは何がありますか？", faqNews: "最新のAI情報を見る", faqMember: "会員登録について", faqStore: "マーケットプレイスで購入できますか？", faqContact: "Jamesへの連絡方法", footer: "© 2026 James · リスタートラボ · 高雄",
  },
} as const;

const knowledge: KnowledgeItem[] = [
  { title: "關於我", href: "/about", keywords: "james 詹姆士 詹棋庭 重啟實驗室 about", description: "認識 James 與重啟實驗室。" },
  { title: "AI 工具", href: "/tools", keywords: "工具 tool tools claude chatgpt cursor 像素辦公室 pixel office", description: "查看 James 整理與製作的 AI 工具。" },
  { title: "AI 情報中心", href: "/news", keywords: "情報 news openai deepmind hugging face arxiv", description: "追蹤最新 AI 產品、模型與研究消息。" },
  { title: "學習文章", href: "/articles", keywords: "文章 article claude chatgpt agent 教學", description: "閱讀 AI 教學、Prompt 與實作筆記。" },
  { title: "購買清單", href: "/shop", keywords: "購買 筆電 設備 rtx buying laptop", description: "查看 AI 筆電與創作設備整理。" },
  { title: "聯絡 James", href: "/contact", keywords: "聯絡 contact email instagram", description: "從聯絡頁找到公開聯絡方式。" },
  { title: "會員中心", href: "/login", keywords: "會員 login register 驗證 點數 簽到", description: "查看會員申請、驗證與點數 MVP。" },
  { title: "ChatGPT Agent 入門指南", href: "/articles/chatgpt-agent", keywords: "chatgpt agent 教學", description: "從基礎認識 ChatGPT Agent 的使用情境。" },
  { title: "Claude 100 個提示詞短指令", href: "/articles/claude-secret-codes-100", keywords: "claude slash codes 隱藏指令 短指令 prompt ghost mirror deepthink redteam", description: "查看 10 大類、100 個 Claude 提示詞短指令與正確使用方式。" },
];

function replyFor(value: string, language: SiteLanguage) {
  const text = value.toLowerCase();
  const includes = (...terms: string[]) => terms.some((term) => text.includes(term));
  const zh = language === "zh-Hant";
  const ja = language === "ja";
  const response = (zhText: string, enText: string, jaText: string) => zh ? zhText : ja ? jaText : enText;

  if (includes("你好", "hello", "こんにちは", "陪", "聊天")) return { text: response("你好！我可以陪你簡短聊聊，也可以幫你找到網站內的工具、文章、AI 情報與會員入口。", "Hi! I can chat briefly and help you find tools, articles, AI news, and membership pages.", "こんにちは。短い会話と、ツール・記事・AI情報・会員ページの案内ができます。"), items: [] };
  if (includes("網站", "what is", "このサイト")) return { text: response("這裡是重啟實驗室 James AI Build Log，用來整理 AI 工具、學習文章、創作紀錄與 AI 情報。", "This is Restart Lab, James AI Build Log: a home for AI tools, learning articles, build notes, and AI news.", "ここはリスタートラボ、James AI Build Logです。AIツール、学習記事、制作記録、AI情報をまとめています。"), items: knowledge.filter((item) => item.href === "/about") };
  if (includes("james", "詹姆士", "詹棋庭", "誰")) return { text: response("James 是重啟實驗室的建立者，透過這個網站分享 AI 工具、學習內容與實作紀錄。", "James created Restart Lab and shares AI tools, learning materials, and build notes here.", "Jamesはリスタートラボの運営者で、AIツール、学習内容、制作記録を共有しています。"), items: [{ title: "關於我", href: "/about", keywords: "", description: "認識 James 與重啟實驗室。" }] };
  if (includes("情報", "news", "最新", "ai 情報")) return { text: response("你可以到 AI 情報中心追蹤最新產品發布、模型更新與研究消息。", "Open the AI News Center for product launches, model updates, and research news.", "AI情報センターで製品リリース、モデル更新、研究ニュースを確認できます。"), items: knowledge.filter((item) => item.href === "/news") };
  if (includes("工具", "tool", "像素", "pixel", "office")) return { text: response("工具頁整理了 James 推薦與製作的 AI 工具，也包含 AI 像素辦公室教學包。", "The Tools page includes James's AI tools and the AI pixel office tutorial pack.", "ツールページにはJamesのAIツールとAIピクセルオフィス教材があります。"), items: knowledge.filter((item) => item.href === "/tools") };
  if (includes("隱藏指令", "斜線指令", "slash code", "slash command", "/ghost", "deepthink", "redteam")) return { text: response("我已收錄 Claude 100 個提示詞短指令。它們是方便叫出工作框架的自訂縮寫，不是官方解鎖權限；文章內有完整分類、用途與正確使用方式。", "I added a guide to 100 Claude prompt shortcuts. They are custom shorthand for workflows, not official permission unlocks.", "Claude向けの100個のプロンプト短縮コードを収録しました。公式の権限解除ではなく、作業フレームを呼び出すための独自ショートハンドです。"), items: knowledge.filter((item) => item.href === "/articles/claude-secret-codes-100") };
  if (includes("claude")) return { text: response("我找到 Claude 相關文章與工具入口，包含 100 個提示詞短指令攻略。", "I found Claude-related articles and tools, including the 100 prompt shortcuts guide.", "Claude関連の記事とツール、100個のプロンプト短縮コードガイドが見つかりました。"), items: knowledge.filter((item) => item.href === "/articles" || item.href.includes("claude")) };
  if (includes("agent")) return { text: response("ChatGPT Agent 入門指南會帶你認識 Agent 的用途、流程與限制。", "The ChatGPT Agent guide covers its uses, workflow, and limitations.", "ChatGPT Agent入門ガイドでは用途、流れ、制限を紹介しています。"), items: knowledge.filter((item) => item.href === "/articles/chatgpt-agent") };
  if (includes("聯絡", "contact", "email", "instagram")) return { text: response("你可以從聯絡頁找到 James 的公開聯絡方式。", "The Contact page lists James's public contact options.", "お問い合わせページからJamesの公開連絡先を確認できます。"), items: knowledge.filter((item) => item.href === "/contact") };
  if (includes("會員", "member", "登入", "login", "驗證", "verification")) return { text: response("會員中心目前是前端測試模式：可預覽註冊、6 位數驗證與點數，但不會建立正式帳號或取得後台權限。", "Member Center is a front-end test mode: you can preview registration, a 6-digit check, and points, but no real account or admin access is granted.", "会員センターはフロントエンドのテストモードです。登録、6桁確認、ポイントを試せますが、正式アカウントや管理権限は付与されません。"), items: knowledge.filter((item) => item.href === "/login") };
  if (includes("商城", "marketplace", "購買", "purchase", "付款", "payment")) return { text: response("AI 商城購買功能暫未開放，正式金流上線後才會開放購買與解鎖。", "Marketplace purchases are not open yet. Buying and unlocks will be available after the real payment flow launches.", "AIマーケットプレイスの購入機能は未公開です。正式な決済導入後に購入と解除を開始します。"), items: [{ title: "AI 商城", href: "/marketplace", keywords: "", description: "查看商品展示與目前開放狀態。" }] };
  if (includes("點數", "point", "簽到", "check in", "weekly")) return { text: response("點數 MVP 在會員中心：完成測試模式驗證後，每日可簽到一次、每週可加點一次；目前不能兌換商品。", "The points MVP is in Member Center. After test verification, you can claim daily and weekly points; rewards are not available yet.", "ポイントMVPは会員センターにあります。テスト確認後、毎日・毎週ポイントを受け取れますが、交換商品は未実装です。"), items: knowledge.filter((item) => item.href === "/login") };

  const matches = knowledge.filter((item) => `${item.title} ${item.keywords} ${item.description}`.toLowerCase().includes(text)).slice(0, 3);
  return matches.length ? { text: response(`我找到 ${matches.length} 個相關入口，請從下方結果繼續。`, `I found ${matches.length} related pages below.`, `関連するページを${matches.length}件見つけました。`), items: matches } : { text: languageCopy[language].noAnswer, items: [] };
}

export function SiteShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [language, setLanguage] = useState<SiteLanguage>("zh-Hant");
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [results, setResults] = useState<KnowledgeItem[]>(knowledge.slice(0, 3));
  const copy = languageCopy[language];

  useEffect(() => {
    const saved = localStorage.getItem("james-site-language") as SiteLanguage | null;
    const loadLanguage = window.setTimeout(() => {
      if (saved === "zh-Hant" || saved === "en" || saved === "ja") setLanguage(saved);
    }, 0);
    return () => window.clearTimeout(loadLanguage);
  }, []);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem("james-site-language", language);
    window.dispatchEvent(new CustomEvent(siteLanguageEvent, { detail: language }));
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
      if (event.key === "Escape") { setMenuOpen(false); setAssistantOpen(false); }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => { document.body.classList.remove("menu-open"); window.removeEventListener("keydown", onKeyDown); };
  }, [menuOpen]);

  const menuGroups = useMemo(() => [
    { title: copy.mainPages, links: [[copy.home, "/"], [copy.about, "/about"], [copy.tools, "/tools"], [copy.articles, "/articles"], [copy.shop, "/shop"], [copy.contact, "/contact"], [copy.news, "/news"]] },
    { title: copy.memberPages, links: [[copy.login, "/login"], [copy.downloads, "/downloads"], [copy.admin, "/dashboard"]] },
  ], [copy]);

  const footerLinks = [[copy.home, "/"], [copy.news, "/news"], [copy.about, "/about"], [copy.tools, "/tools"], [copy.articles, "/articles"], [copy.shop, "/shop"], [copy.contact, "/contact"]];

  function ask(value: string) {
    const trimmed = value.trim();
    if (!trimmed) return;
    const response = replyFor(trimmed, language);
    setMessages((previous) => [...previous, { role: "user" as const, text: trimmed }, { role: "assistant" as const, text: response.text }].slice(-8));
    setResults(response.items.length ? response.items : knowledge.slice(0, 3));
    setQuery("");
  }

  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); ask(query); }

  return <>
    <header className="site-header"><nav className="nav" aria-label="主選單">
      <Link className="brand site-brand" href="/" aria-label={copy.home}><span className="mark"><Image className="site-brand-avatar" src="/assets/images/avatar.jpg" alt="James" width={38} height={38} priority /></span><span className="site-brand-copy"><strong>重啟實驗室</strong><small>James AI Build Log</small></span></Link>
      <div className="language-switcher"><span>{copy.language}</span><select className="language-select" aria-label={`${copy.language} / Language`} value={language} onChange={(event) => setLanguage(event.target.value as SiteLanguage)}><option value="zh-Hant">繁中</option><option value="en">English</option><option value="ja">日本語</option></select></div>
      <button className="menu-toggle" type="button" aria-label={copy.openMenu} aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><span /><span /><span /></button>
    </nav></header>
    <main id="main-content">{children}</main>
    <footer className="footer"><div className="wrap"><span>{copy.footer}</span><div className="footer-links">{footerLinks.map(([label, href]) => <Link key={href} href={href}>{label}</Link>)}</div></div></footer>
    <button className="menu-backdrop" aria-label={copy.closeMenu} onClick={() => setMenuOpen(false)} />
    <aside className="site-menu" aria-label={copy.menu} aria-hidden={!menuOpen}><div className="site-menu-head"><div><strong>{copy.menu}</strong><span>{copy.menuHint}</span></div><button className="menu-close" type="button" aria-label={copy.closeMenu} onClick={() => setMenuOpen(false)}>×</button></div><div className="site-menu-body">{menuGroups.map((group, index) => <details className="menu-group" open={index === 0} key={group.title}><summary>{group.title}</summary>{group.links.map(([label, href]) => <Link className={pathname === href ? "active" : ""} href={href} key={href} onClick={() => setMenuOpen(false)}>{label}</Link>)}</details>)}</div></aside>
    <div className={`ai-helper has-reminder${assistantOpen ? " open" : ""}`}>
      <div className="ai-panel" role="dialog" aria-label={copy.assistant} aria-hidden={!assistantOpen}>
        <div className="ai-panel-head"><div className="ai-panel-title-row"><div><h2>{copy.assistant}</h2><p className="ai-note">{copy.greeting}</p></div><button className="ai-panel-close" type="button" aria-label={copy.closeAssistant} onClick={() => setAssistantOpen(false)}>×</button></div></div>
        <div className="ai-panel-scroll">
          <div className="ai-quick">{copy.quick.map((question) => <button type="button" key={question} onClick={() => ask(question)}>{question}</button>)}</div>
          <details className="ai-faq"><summary>{copy.faq}</summary><button type="button" onClick={() => ask(copy.faqTools)}>{copy.faqTools}</button><button type="button" onClick={() => ask(copy.faqNews)}>{copy.faqNews}</button><button type="button" onClick={() => ask(copy.faqMember)}>{copy.faqMember}</button><button type="button" onClick={() => ask(copy.faqStore)}>{copy.faqStore}</button><button type="button" onClick={() => ask(copy.faqContact)}>{copy.faqContact}</button></details>
          <div className="ai-chat-history" aria-live="polite">{messages.length ? messages.map((message, index) => <p className={`ai-chat-message ${message.role}`} key={`${message.role}-${index}`}>{message.text}</p>) : <p className="ai-chat-message assistant">{copy.greeting}</p>}</div>
          <div className="ai-results">{results.map((item) => <Link href={item.href} key={item.href} onClick={() => setAssistantOpen(false)}><strong>{translateSiteText(item.title, language)}</strong><span>{translateSiteText(item.description, language)}</span></Link>)}</div>
        </div>
        <form className="ai-chat-form" onSubmit={submit}><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder={copy.prompt} aria-label={copy.assistant} /><button type="submit">{copy.send}</button><button type="button" className="ai-clear" onClick={() => { setQuery(""); setMessages([]); setResults(knowledge.slice(0, 3)); }}>{copy.clear}</button></form>
      </div>
      <button className="ai-orb" type="button" aria-label={copy.openAssistant} aria-expanded={assistantOpen} onClick={() => setAssistantOpen((open) => !open)}><span className="ai-hover-greeting">{copy.greetingBubble}</span><span className="ai-notice-badge">1</span><img className="ai-orb-image" src="/assets/images/ai-helper-robot.png" alt={copy.assistant} /></button>
    </div>
    <LegacyRuntime language={language} />
  </>;
}
