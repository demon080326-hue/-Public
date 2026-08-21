import Link from "next/link";
import { getPublishedNews } from "@/lib/news";
import type { NewsItem } from "@/types/database";

const featuredTools = [
  { label: "學 AI · 入門", title: "AI 學習入門地圖", href: "https://timely-pastelito-6e1043.netlify.app/", description: "把 AI 學習方向整理成可實作的起點。" },
  { label: "學 AI · 提示詞", title: "Claude 提示詞實戰手冊", href: "https://genuine-macaron-00af9c.netlify.app/", description: "從工作場景出發，建立可重複使用的提示詞方法。" },
  { label: "AI Agent · 團隊協作", title: "AI 像素辦公室教學包", href: "https://app.notion.com/p/AI-39ee0751f8e88129b599f4b20acd22b7", description: "用角色設定打造會自行運作的 AI 團隊工作空間。" },
];

const projects = [
  { label: "Website", title: "James AI Build Log V2", href: "/projects", description: "將靜態網站持續升級成 AI 個人品牌平台的完整建置紀錄。" },
  { label: "Agent", title: "AI Agent 工作流", href: "/projects", description: "整理可持續擴充的 AI Agent 流程、案例與實作方向。" },
  { label: "Automation", title: "自動化系統", href: "/projects", description: "預留 AI 自動化、資料庫與客服工作流的實驗空間。" },
];

const documents = [
  { label: "Claude／Prompt", title: "Claude 大祕寶：100 個提示詞短指令", href: "/articles/claude-secret-codes-100" },
  { label: "ChatGPT", title: "ChatGPT Agent 入門指南", href: "/articles/chatgpt-agent" },
  { label: "Knowledge", title: "全部學習文章與建置筆記", href: "/articles" },
];

function formatNewsDate(value: string | null) {
  if (!value) return "近期更新";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "近期更新";
  return new Intl.DateTimeFormat("zh-TW", { month: "numeric", day: "numeric" }).format(date);
}

export async function HomeV2Preview() {
  let news: NewsItem[] = [];
  try {
    news = await getPublishedNews(3);
  } catch {
    news = [];
  }

  return (
    <div className="home-v2-preview">
      <section className="home-v2-section home-v2-tools" data-home-reveal="section">
        <div className="wrap">
          <div className="home-v2-heading">
            <div><p>SELECTED SYSTEMS</p><h2>工具不是收藏，而是工作流程。</h2></div>
            <Link href="/tools" data-home-magnetic>查看所有工具 <span aria-hidden="true">→</span></Link>
          </div>
          <div className="home-v2-grid home-v2-grid-tools">
            {featuredTools.map((tool) => (
              <a className="home-v2-card home-tool-preview" data-home-card key={tool.title} href={tool.href} target="_blank" rel="noopener noreferrer">
                <div><span>{tool.label}</span><h3>{tool.title}</h3><p>{tool.description}</p></div><b>開啟資源 <i aria-hidden="true">↗</i></b>
              </a>
            ))}
          </div>
        </div>
      </section>

      <section className="home-v2-section home-v2-projects" data-home-reveal="section">
        <div className="wrap">
          <div className="home-v2-heading home-v2-heading-light">
            <div><p>LAB PROJECTS</p><h2>把想法變成可被驗證的作品。</h2></div>
            <Link href="/projects" data-home-magnetic>進入專案實驗室 <span aria-hidden="true">→</span></Link>
          </div>
          <div className="home-v2-grid home-v2-grid-projects">
            {projects.map((project, index) => (
              <Link className="home-v2-card home-project-preview" data-home-card href={project.href} key={project.title}>
                <span className="home-project-index">0{index + 1}</span><div><span>{project.label}</span><h3>{project.title}</h3><p>{project.description}</p></div><b>查看專案 <i aria-hidden="true">→</i></b>
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="home-v2-section home-v2-intelligence" data-home-reveal="section">
        <div className="wrap">
          <div className="home-v2-heading">
            <div><p>LATEST INTELLIGENCE</p><h2>把每天的 AI 變化，變成下一步判斷。</h2></div>
            <Link href="/news" data-home-magnetic>進入 AI 情報中心 <span aria-hidden="true">→</span></Link>
          </div>
          <div className="home-v2-grid home-v2-grid-news">
            {news.length ? news.map((item) => (
              <Link className="home-v2-card home-news-preview" data-home-card href={`/news/${item.id}`} key={item.id}>
                <div className="home-news-meta"><span>{item.category}</span><time>{formatNewsDate(item.published_at)}</time></div><h3>{item.title_zh}</h3><p>{item.summary_short ?? "掌握最新 AI 工具、模型與產業變化。"}</p><b>閱讀情報 <i aria-hidden="true">→</i></b>
              </Link>
            )) : (
              <Link className="home-v2-card home-news-preview" data-home-card href="/news"><div className="home-news-meta"><span>AI 情報</span><time>即時更新</time></div><h3>前往 AI 情報中心</h3><p>查看目前已發布的 AI 產品、技術與研究資訊。</p><b>閱讀情報 <i aria-hidden="true">→</i></b></Link>
            )}
          </div>
        </div>
      </section>

      <section className="home-v2-section home-v2-documents" data-home-reveal="section">
        <div className="wrap home-v2-documents-layout">
          <div><p className="home-v2-label">KNOWLEDGE / DOCUMENTS</p><h2>把複雜的 AI 學習，整理成能回頭使用的知識。</h2><p>從工具選擇、提示詞、Agent 到實作紀錄，所有閱讀內容都保留在同一座實驗室。</p><Link href="/articles" className="home-v2-text-link" data-home-magnetic>探索文章與文件 <span aria-hidden="true">→</span></Link></div>
          <div className="home-documents-list">
            {documents.map((document, index) => <Link href={document.href} key={document.title}><span>0{index + 1}</span><div><small>{document.label}</small><strong>{document.title}</strong></div><i aria-hidden="true">→</i></Link>)}
          </div>
        </div>
      </section>
    </div>
  );
}
