"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useRef, useState } from "react";

type CmsItem = {
  id: string;
  type: string;
  status: string;
  title: string;
  slug: string;
  category: string;
  image: string;
  tags: string[];
  price: string;
  summary: string;
  body: string;
  file: string;
  updatedAt: string;
};

const storageKey = "james-cms-items-v1";
const typeLabels: Record<string, string> = { article: "文章", tool: "工具", product: "商品", newsletter: "電子報" };

function slugify(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-").replace(/^-+|-+$/g, "") || "new-content";
}

function fileFor(type: string, slug: string) {
  const folders: Record<string, string> = { article: "articles", tool: "tools", product: "shop", newsletter: "newsletter" };
  return `${folders[type] ?? type}/${slug}.html`;
}

export function CmsDashboard() {
  const formRef = useRef<HTMLFormElement>(null);
  const [items, setItems] = useState<CmsItem[]>([]);
  const [preview, setPreview] = useState<CmsItem | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [output, setOutput] = useState("尚未建立內容。");

  useEffect(() => {
    const loadStoredItems = window.setTimeout(() => {
      try {
        setItems(JSON.parse(localStorage.getItem(storageKey) ?? "[]") as CmsItem[]);
      } catch {
        setItems([]);
      }
    }, 0);
    return () => window.clearTimeout(loadStoredItems);
  }, []);

  function persist(nextItems: CmsItem[]) {
    setItems(nextItems);
    localStorage.setItem(storageKey, JSON.stringify(nextItems, null, 2));
  }

  function itemFromForm(form: HTMLFormElement, id = editingId ?? "cms-preview") {
    const data = new FormData(form);
    const title = String(data.get("title") ?? "").trim();
    const type = String(data.get("type") ?? "article");
    const slug = slugify(String(data.get("slug") || title));
    return {
      id,
      type,
      status: String(data.get("status") ?? "draft"),
      title,
      slug,
      category: String(data.get("category") ?? ""),
      image: String(data.get("image") ?? ""),
      tags: String(data.get("tags") ?? "").split(",").map((tag) => tag.trim()).filter(Boolean),
      price: String(data.get("price") ?? ""),
      summary: String(data.get("summary") ?? ""),
      body: String(data.get("body") ?? ""),
      file: fileFor(type, slug),
      updatedAt: new Date().toISOString(),
    } satisfies CmsItem;
  }

  function handleInput() {
    if (formRef.current) setPreview(itemFromForm(formRef.current));
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const item = itemFromForm(event.currentTarget, editingId ?? `cms-${Date.now()}`);
    const nextItems = editingId ? items.map((entry) => (entry.id === editingId ? item : entry)) : [item, ...items];
    persist(nextItems);
    setOutput(JSON.stringify(item, null, 2));
    setPreview(item);
    setEditingId(null);
    event.currentTarget.reset();
  }

  function editItem(item: CmsItem) {
    const form = formRef.current;
    if (!form) return;
    const values: Record<string, string> = { ...item, tags: item.tags.join(", ") };
    Object.entries(values).forEach(([name, value]) => {
      const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement | null;
      if (field) field.value = String(value);
    });
    setEditingId(item.id);
    setPreview(item);
    setOutput(JSON.stringify(item, null, 2));
    form.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function deleteItem(id: string) {
    if (!window.confirm("確定要刪除這筆本機 CMS 草稿嗎？")) return;
    const nextItems = items.filter((item) => item.id !== id);
    persist(nextItems);
    setOutput(JSON.stringify({ deleted: id, items: nextItems }, null, 2));
  }

  function exportItems() {
    const data = JSON.stringify({ exportedAt: new Date().toISOString(), items }, null, 2);
    setOutput(data);
    const url = URL.createObjectURL(new Blob([data], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "james-cms-content.json";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  const visibleItems = useMemo(() => filter === "all" ? items : items.filter((item) => item.type === filter), [filter, items]);

  return (
    <>
      <section className="page-hero"><div className="wrap"><p className="eyebrow">CMS</p><h1>內容管理系統 MVP</h1><p className="page-copy">保留舊版前端 CMS 草稿功能，並接回目前可用的 AI 情報管理入口。</p></div></section>
      <section className="section">
        <div className="wrap cms-admin">
          <div className="cms-admin-head"><div><p className="eyebrow">Content Admin</p><h2>上架內容</h2></div><div className="cms-admin-actions"><button className="btn secondary" type="button" onClick={exportItems}>匯出 JSON</button><button className="btn secondary" type="button" onClick={() => { if (window.confirm("確定清空這台電腦的 CMS 暫存嗎？")) persist([]); }}>清空暫存</button></div></div>
          <div className="cms-layout">
            <form className="cms-panel cms-form" ref={formRef} onInput={handleInput} onSubmit={handleSubmit}>
              <div className="cms-field-row">
                <label>內容類型<select className="form-input" name="type"><option value="article">文章</option><option value="tool">工具</option><option value="product">商品</option><option value="newsletter">電子報</option></select></label>
                <label>狀態<select className="form-input" name="status"><option value="draft">草稿</option><option value="ready">可上架</option><option value="published">已上架</option></select></label>
              </div>
              <label>標題<input className="form-input" name="title" required placeholder="輸入標題" /></label>
              <div className="cms-field-row"><label>Slug / 檔名<input className="form-input" name="slug" placeholder="系統可自動產生" /></label><label>分類<input className="form-input" name="category" placeholder="Claude / 工具 / 商品分類" /></label></div>
              <label>圖片<input className="form-input" name="image" required placeholder="/assets/images/example.jpg 或圖片網址" /></label>
              <div className="cms-field-row"><label>標籤<input className="form-input" name="tags" placeholder="用逗號分隔" /></label><label>價格 / 期數<input className="form-input" name="price" /></label></div>
              <label>摘要<textarea className="form-input" name="summary" rows={4} required /></label>
              <label>內容<textarea className="form-input" name="body" rows={8} /></label>
              <div className="cms-submit-row"><button className="btn" type="submit">{editingId ? "更新內容" : "儲存內容"}</button><button className="btn secondary" type="reset" onClick={() => { setEditingId(null); setPreview(null); }}>清空表單</button></div>
            </form>
            <aside className="cms-panel">
              <h2>即時預覽</h2>
              <div className="cms-preview">{preview ? <article className="cms-preview-card">{preview.image ? <img src={preview.image} alt={preview.title} /> : null}<div><span className="cms-pill">{typeLabels[preview.type]}</span><h3>{preview.title || "尚未輸入標題"}</h3><p>{preview.summary}</p><dl><div><dt>分類</dt><dd>{preview.category || "未分類"}</dd></div><div><dt>狀態</dt><dd>{preview.status}</dd></div><div><dt>路徑</dt><dd>{preview.file}</dd></div></dl></div></article> : <div className="cms-preview-empty">新增內容後會顯示預覽。</div>}</div>
              <h2>資料輸出</h2><pre className="cms-output">{output}</pre>
            </aside>
          </div>
          <div className="cms-panel cms-library">
            <div className="cms-library-head"><h2>內容庫</h2><div className="cms-tabs">{["all", "article", "tool", "product", "newsletter"].map((value) => <button className={filter === value ? "active" : ""} type="button" key={value} onClick={() => setFilter(value)}>{value === "all" ? "全部" : typeLabels[value]}</button>)}</div></div>
            <div className="cms-list">{visibleItems.length ? visibleItems.map((item) => <article className="cms-item" key={item.id}>{item.image ? <img src={item.image} alt={item.title} /> : <div />}<div><div className="cms-item-meta"><span className="cms-pill">{typeLabels[item.type]}</span><span>{item.status}</span></div><h3>{item.title}</h3><p>{item.summary}</p><small>{item.file}</small></div><div className="cms-item-actions"><button type="button" onClick={() => editItem(item)}>編輯</button><button type="button" onClick={() => deleteItem(item.id)}>刪除</button></div></article>) : <div className="cms-empty">目前沒有符合條件的內容。</div>}</div>
          </div>
        </div>
      </section>
      <section className="section dashboard-ai-admin"><div className="wrap"><div className="section-head"><div><span className="section-kicker">Restart AI Intelligence</span><h2>AI 情報管理</h2></div><p>AI 情報維持原本 Supabase 與自動收集流程；這裡只提供目前安全可用的管理入口。</p></div><div className="route-grid four"><Link className="route-card" href="/admin/news/new"><div><span className="tag">Admin</span><h3>手動新增 AI 情報</h3><p>使用現有表單寫入 Supabase public.ai_news。</p></div><span className="card-link">開啟表單 &rarr;</span></Link><Link className="route-card" href="/news"><div><span className="tag">Frontend</span><h3>查看 AI 情報中心</h3><p>檢查列表、摘要、標籤與文章詳細頁。</p></div><span className="card-link">查看前台 &rarr;</span></Link></div></div></section>
    </>
  );
}
