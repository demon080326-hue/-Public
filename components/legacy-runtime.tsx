"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { SiteLanguage, translateSiteText } from "@/lib/site-language";

type Member = {
  name: string;
  email: string;
  level: string;
  points: number;
  purchases: string[];
  downloads: string[];
};

const memberKey = "james-ai-member";
const originalText = new WeakMap<Text, string>();

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
  document.querySelectorAll<HTMLElement>("[data-member-guest]").forEach((element) => (element.hidden = Boolean(member)));
  document.querySelectorAll<HTMLElement>("[data-member-auth]").forEach((element) => (element.hidden = !member));
  document.querySelectorAll<HTMLElement>("[data-member-name]").forEach((element) => (element.textContent = member?.name ?? "訪客"));
  document.querySelectorAll<HTMLElement>("[data-member-email]").forEach((element) => (element.textContent = member?.email ?? ""));
  document.querySelectorAll<HTMLElement>("[data-member-level]").forEach((element) => (element.textContent = member?.level ?? "Guest"));
  document.querySelectorAll<HTMLElement>("[data-member-points]").forEach((element) => (element.textContent = String(member?.points ?? 0)));
  document.querySelectorAll<HTMLElement>("[data-member-purchase-count]").forEach((element) => (element.textContent = String(member?.purchases.length ?? 0)));
  document.querySelectorAll<HTMLElement>("[data-member-download-count]").forEach((element) => (element.textContent = String(member?.downloads.length ?? 0)));

  document.querySelectorAll<HTMLElement>("[data-purchase-required]").forEach((card) => {
    const productId = card.dataset.purchaseRequired ?? "";
    const unlocked = Boolean(member?.purchases.includes(productId));
    card.classList.toggle("is-locked", !unlocked);
    card.classList.toggle("is-unlocked", unlocked);
    card.querySelectorAll<HTMLElement>("[data-lock-guest]").forEach((element) => (element.hidden = Boolean(member)));
    card.querySelectorAll<HTMLElement>("[data-lock-purchase]").forEach((element) => (element.hidden = !member || unlocked));
    card.querySelectorAll<HTMLElement>("[data-purchase-content]").forEach((element) => (element.hidden = !unlocked));
    card.querySelectorAll<HTMLButtonElement>("[data-purchase-action]").forEach((button) => {
      button.textContent = !member ? "登入會員" : unlocked ? "已解鎖" : "購買解鎖";
      button.disabled = unlocked;
    });
  });

  const purchaseList = document.querySelector<HTMLElement>("[data-member-purchase-list]");
  if (purchaseList) {
    purchaseList.innerHTML = member?.purchases.length
      ? member.purchases.map((item) => `<li>${item}</li>`).join("")
      : "<li>目前還沒有購買紀錄</li>";
  }
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
}

export function LegacyRuntime({ language }: { language: SiteLanguage }) {
  const pathname = usePathname();
  const router = useRouter();

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

    const onSubmit = (event: SubmitEvent) => {
      const form = event.target as HTMLFormElement;
      if (!form.matches("[data-member-form]")) return;
      event.preventDefault();
      const data = new FormData(form);
      const member: Member = {
        name: String(data.get("name") || "James AI Club 會員"),
        email: String(data.get("email") || ""),
        level: "Starter",
        points: 100,
        purchases: readMember()?.purchases ?? [],
        downloads: readMember()?.downloads ?? [],
      };
      localStorage.setItem(memberKey, JSON.stringify(member));
      renderMemberState();
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-member-logout]")) {
        localStorage.removeItem(memberKey);
        renderMemberState();
        return;
      }
      const purchase = target.closest<HTMLButtonElement>("[data-purchase-action]");
      if (!purchase) return;
      const member = readMember();
      if (!member) {
        router.push("/login");
        return;
      }
      const productId = purchase.dataset.purchaseAction;
      if (productId && !member.purchases.includes(productId)) {
        member.purchases.push(productId);
        member.points += 30;
        member.level = "Paid Member";
        localStorage.setItem(memberKey, JSON.stringify(member));
        window.alert("內容已在本機會員 MVP 中解鎖。");
        renderMemberState();
      }
    };

    document.addEventListener("submit", onSubmit);
    document.addEventListener("click", onClick);
    return () => {
      window.clearInterval(clock);
      search?.removeEventListener("input", onSearch);
      document.removeEventListener("submit", onSubmit);
      document.removeEventListener("click", onClick);
    };
  }, [language, pathname, router]);

  return null;
}
