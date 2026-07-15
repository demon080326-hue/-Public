export const aiNewsSources = [
  {
    id: "huggingface-blog",
    name: "Hugging Face",
    type: "rss",
    url: "https://huggingface.co/blog/feed.xml",
    category: "AI 工具",
    enabled: true,
  },
  {
    id: "openai-news",
    name: "OpenAI",
    type: "rss",
    url: "https://openai.com/news/rss.xml",
    category: "AI 平台",
    enabled: true,
  },
  {
    id: "google-deepmind",
    name: "Google DeepMind",
    type: "rss",
    url: "https://deepmind.google/blog/rss.xml",
    category: "研究論文",
    enabled: true,
  },
  {
    id: "anthropic-news",
    name: "Anthropic",
    type: "rss",
    url: "https://www.anthropic.com/news/rss.xml",
    category: "AI 平台",
    // Anthropic 官方新聞頁目前未確認可用 RSS，先停用。未來可改用官方頁面抓取或可用 RSS 來源。
    enabled: false,
  },
];
