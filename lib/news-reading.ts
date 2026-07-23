import type { NewsItem } from "@/types/database";

const categoryGuidance: Record<string, string> = {
  "AI 工具": "可以先評估它是否能改善現有工作流、內容製作速度或工具選擇。",
  "AI 平台": "可以留意平台能力、使用方式與既有服務整合是否出現變化。",
  "AI 日報": "適合快速掌握同一天的重要產品、模型與產業動態。",
  "AI 電子報": "適合用來補充一週內值得追蹤的產品與產業訊號。",
  "研究論文": "可以關注研究成果距離實際產品化還有多遠，以及可能影響哪些應用。",
  "技術趨勢": "可以觀察技術成熟度、效能變化與實際導入成本。",
  "產品發布": "可以優先確認新功能是否已開放、適用對象與使用限制。",
};

function cleanText(value: string | null | undefined) {
  return String(value ?? "")
    .replace(/^#+\s*/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

function unique(items: string[]) {
  return [...new Set(items.map(cleanText).filter(Boolean))];
}

export function buildNewsHighlights(item: NewsItem) {
  const titleParts = item.title_zh
    .split(/[；;｜|]/)
    .map((part) => cleanText(part))
    .filter((part) => part.length >= 4)
    .slice(0, 3);

  const highlights =
    titleParts.length > 1
      ? titleParts.map((part) => `本篇涵蓋：${part.replace(/^AI日報[:：]\s*/, "")}。`)
      : [`核心主題是「${cleanText(item.title_zh)}」。`];

  const summary = cleanText(item.summary_short);
  if (summary && !highlights.some((point) => point.includes(summary))) {
    highlights.push(summary);
  }

  highlights.push(
    categoryGuidance[item.category] ??
      "可以先確認這項更新影響的使用者、實際應用情境與後續發展。",
  );
  highlights.push(`資訊來自 ${item.source_name}，完整細節仍以原始來源為準。`);

  return unique(highlights).slice(0, 6);
}

export function buildNewsReadingSummary(item: NewsItem) {
  const title = cleanText(item.title_zh);
  const guidance =
    categoryGuidance[item.category] ??
    "這則內容可用來掌握近期 AI 產品、技術或產業應用的變化。";

  return `${item.source_name} 這篇情報聚焦「${title}」，屬於「${item.category}」主題。${guidance} 建議先看下方重點，再依需要前往原始來源確認完整內容。`;
}

export function buildWhyItMatters(item: NewsItem) {
  const existing = cleanText(item.why_it_matters);
  if (existing) return existing;

  return `這項「${item.category}」資訊可能影響工具選擇、內容創作、產品規劃或開發流程。先理解更新解決的問題與使用限制，有助於判斷是否值得現在導入。`;
}
