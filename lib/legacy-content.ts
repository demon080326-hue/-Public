import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const legacyRoot = join(process.cwd(), "content", "legacy");

export const legacyRootPages = [
  "marketplace",
  "community",
  "courses",
  "prompts",
  "projects",
  "newsletter",
  "podcast",
] as const;

const routeAliases: Record<string, string> = {
  "index.html": "/",
  "about.html": "/about",
  "tools.html": "/tools",
  "articles.html": "/articles",
  "shop.html": "/shop",
  "contact.html": "/contact",
  "news.html": "/news",
  "member.html": "/login",
  "downloads.html": "/downloads",
  "cms.html": "/dashboard",
  "platform.html": "/platform",
};

function rewriteLocalUrl(value: string) {
  if (/^(?:https?:|mailto:|tel:|data:|#)/i.test(value)) return value;

  const match = value.match(/^([^?#]*)([?#].*)?$/);
  const suffix = match?.[2] ?? "";
  const cleanPath = (match?.[1] ?? value).replace(/^(?:\.\.\/|\.\/)+/, "");

  if (cleanPath.startsWith("assets/")) return `/${cleanPath}${suffix}`;
  if (routeAliases[cleanPath]) return `${routeAliases[cleanPath]}${suffix}`;

  if (cleanPath.startsWith("articles/") && cleanPath.endsWith(".html")) {
    return `/${cleanPath.slice(0, -5)}${suffix}`;
  }

  if (cleanPath.endsWith(".html")) return `/${cleanPath.slice(0, -5)}${suffix}`;
  return value;
}

function extractMain(html: string) {
  const match = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i);
  if (!match) throw new Error("舊版頁面缺少 <main> 內容。");

  return match[1]
    .replace(/\r\n?/g, "\n")
    .replace(/\s(?:href|src)=(['"])(.*?)\1/gi, (attribute) => {
      const parts = attribute.match(/^(\s(?:href|src)=)(['"])(.*?)\2$/i);
      if (!parts) return attribute;
      return `${parts[1]}${parts[2]}${rewriteLocalUrl(parts[3])}${parts[2]}`;
    })
    .replace(/<script\b[\s\S]*?<\/script>/gi, "");
}

export function getLegacyPageHtml(fileName: string) {
  return extractMain(readFileSync(join(legacyRoot, fileName), "utf8"));
}

export function getLegacyArticleHtml(slug: string) {
  return extractMain(readFileSync(join(legacyRoot, "articles", `${slug}.html`), "utf8"));
}

export function getLegacyArticleSlugs() {
  return readdirSync(join(legacyRoot, "articles"))
    .filter((file) => file.endsWith(".html") && file !== "template.html")
    .map((file) => file.slice(0, -5));
}
