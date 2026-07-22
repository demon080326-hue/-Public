"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { SiteLanguage, translateSiteText } from "@/lib/site-language";

type Member = {
  email: string;
  verified: boolean;
  points: number;
};

const memberKey = "james-member-mvp-v2";
const originalText = new WeakMap<Text, string>();
const originalAttributes = new WeakMap<HTMLElement, Map<string, string>>();

const searchItems = [
  ["關於我", "主要頁面", "James 背景 重啟實驗室", "/about"],
  ["AI 工具", "AI 內容中心", "ChatGPT Claude Cursor 工具", "/tools"],
  ["AI 情報中心", "AI 內容中心", "OpenAI DeepMind Hugging Face", "/news"],
  ["購買清單", "商店與下載", "AI 筆電 設備", "/shop"],
  ["Prompt Library", "AI 內容中心", "Prompt 提示詞 ChatGPT Claude", "/prompts"],
  ["下載中心", "商店與下載", "PDF Checklist SOP", "/downloads"],
  ["會員中心", "會員與社群", "會員 登入 James AI Club", "/login"],
  ["ChatGPT Agent 入門指南", "ChatGPT", "Agent OpenAI 自動化", "/articles/chatgpt-agent"],
  ["Claude Fable 5 完整深度彙整", "Claude", "模型 Anthropic", "/articles/claude-fable-5"],
  ["Claude 大祕寶：100 個提示詞短指令終極攻略", "Claude／Prompt", "Claude slash codes 隱藏指令 短指令 ghost deepthink redteam prompt", "/articles/claude-secret-codes-100"],
] as const;

function readMember(): Member | null {
  try {
    return JSON.parse(localStorage.getItem(memberKey) ?? "null") as Member | null;
  } catch {
    return null;
  }
}

function renderMemberState() {
  const member = readMember();
  const verified = Boolean(member?.verified);
  document.querySelectorAll<HTMLElement>("[data-member-guest]").forEach((element) => (element.hidden = verified));
  document.querySelectorAll<HTMLElement>("[data-member-auth]").forEach((element) => (element.hidden = !verified));
  document.querySelectorAll<HTMLElement>("[data-member-name]").forEach((element) => (element.textContent = verified ? "已驗證會員" : "訪客"));
  document.querySelectorAll<HTMLElement>("[data-member-email]").forEach((element) => (element.textContent = member?.email ?? ""));
  document.querySelectorAll<HTMLElement>("[data-member-level]").forEach((element) => (element.textContent = verified ? "測試模式會員" : "訪客"));
  document.querySelectorAll<HTMLElement>("[data-member-points]").forEach((element) => (element.textContent = String(member?.points ?? 0)));
  document.querySelectorAll<HTMLElement>("[data-member-purchase-count], [data-member-download-count]").forEach((element) => (element.textContent = "0"));

  document.querySelectorAll<HTMLElement>("[data-purchase-required]").forEach((card) => {
    card.classList.add("is-locked");
    card.classList.remove("is-unlocked");
    card.querySelectorAll<HTMLElement>("[data-lock-guest], [data-lock-purchase]").forEach((element) => {
      element.hidden = false;
      element.textContent = "AI 商城購買功能暫未開放，正式金流上線後才會開放購買與解鎖。";
    });
    card.querySelectorAll<HTMLElement>("[data-purchase-content]").forEach((element) => (element.hidden = true));
    card.querySelectorAll<HTMLButtonElement>("[data-purchase-action]").forEach((button) => {
      button.textContent = "暫未開放";
      button.disabled = true;
      button.setAttribute("aria-disabled", "true");
      button.title = "AI 商城購買功能暫未開放";
    });
  });

  const purchaseList = document.querySelector<HTMLElement>("[data-member-purchase-list]");
  if (purchaseList) purchaseList.textContent = "正式購買與解鎖功能尚未開放。";
}

function startClock() {
  const update = () => {
    const now = new Date();
    const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei" }).format(now);
    const days = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse("2026-05-11T00:00:00Z")) / 86_400_000) + 1;
    const percent = Math.max(0, Math.min(100, Math.round(days)));
    const setText = (selector: string, value: string) => document.querySelectorAll<HTMLElement>(selector).forEach((element) => (element.textContent = value));
    setText(".js-time", new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).format(now));
    setText(".js-date", new Intl.DateTimeFormat("zh-TW", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).format(now));
    setText(".js-day", String(days));
    setText(".js-day-pad", String(days).padStart(3, "0"));
    setText(".js-pct", String(percent));
    document.querySelectorAll<HTMLElement>(".js-bar").forEach((element) => (element.style.width = `${percent}%`));
  };
  update();
  return window.setInterval(update, 1000);
}

function translatePage(language: SiteLanguage) {
  const root = document.getElementById("main-content");
  if (!root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;
  while (node) {
    const parent = node.parentElement;
    if (parent && !["SCRIPT", "STYLE"].includes(parent.tagName)) {
      const source = originalText.get(node) ?? node.nodeValue ?? "";
      if (!originalText.has(node)) originalText.set(node, source);
      const trimmed = source.trim();
      if (trimmed) node.nodeValue = source.replace(trimmed, translateSiteText(trimmed, language));
    }
    node = walker.nextNode() as Text | null;
  }

  root.querySelectorAll<HTMLElement>("[placeholder], [aria-label], [title]").forEach((element) => {
    const attributes = originalAttributes.get(element) ?? new Map<string, string>();
    ["placeholder", "aria-label", "title"].forEach((name) => {
      const current = element.getAttribute(name);
      if (current && !attributes.has(name)) attributes.set(name, current);
      const source = attributes.get(name);
      if (source) element.setAttribute(name, translateSiteText(source, language));
    });
    originalAttributes.set(element, attributes);
  });
}

export function LegacyRuntime({ language }: { language: SiteLanguage }) {
  const pathname = usePathname();

  useEffect(() => {
    const clock = startClock();
    renderMemberState();
    translatePage(language);

    const search = document.querySelector<HTMLInputElement>("[data-site-search]");
    const results = document.querySelector<HTMLElement>("[data-search-results]");
    const onSearch = () => {
      if (!search || !results) return;
      const keyword = search.value.trim().toLowerCase();
      if (!keyword) {
        results.innerHTML = "";
        return;
      }
      results.innerHTML = searchItems
        .filter((item) => item.join(" ").toLowerCase().includes(keyword))
        .map(([title, category, tags, href]) => `<a class="article-card" href="${href}"><div><div class="article-meta"><span>${category}</span><span class="date-pill">搜尋結果</span></div><h3>${title}</h3><p>${tags}</p></div><span class="card-link">查看 &rarr;</span></a>`)
        .join("");
    };
    search?.addEventListener("input", onSearch);

    return () => {
      window.clearInterval(clock);
      search?.removeEventListener("input", onSearch);
    };
  }, [language, pathname]);

  return null;
}
