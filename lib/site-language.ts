export type SiteLanguage = "zh-Hant" | "en" | "ja";

type Translation = Partial<Record<Exclude<SiteLanguage, "zh-Hant">, string>>;

const translations: Record<string, Translation> = {
  "重啟實驗室": { en: "Restart Lab", ja: "リスタートラボ" },
  "首頁": { en: "Home", ja: "ホーム" },
  "關於我": { en: "About", ja: "プロフィール" },
  "工具": { en: "Tools", ja: "ツール" },
  "文章": { en: "Articles", ja: "記事" },
  "購買清單": { en: "Buying List", ja: "購入リスト" },
  "聯絡我": { en: "Contact", ja: "お問い合わせ" },
  "AI 情報中心": { en: "AI News Center", ja: "AI情報センター" },
  "會員登入": { en: "Member Login", ja: "会員ログイン" },
  "下載": { en: "Downloads", ja: "ダウンロード" },
  "管理系統": { en: "Admin System", ja: "管理システム" },
  "網站總選單": { en: "Site Menu", ja: "サイトメニュー" },
  "先選大分類，再進小頁面": { en: "Choose a category, then open a page", ja: "カテゴリを選んでページへ進みます" },
  "主要頁面": { en: "Main Pages", ja: "主要ページ" },
  "會員與管理": { en: "Members & Admin", ja: "会員と管理" },
  "用 AI，把人生重新開機。": { en: "Restart your life with AI.", ja: "AIで人生を再起動する。" },
  "認識我": { en: "About James", ja: "Jamesについて" },
  "看 AI 工具": { en: "Explore AI Tools", ja: "AIツールを見る" },
  "看工具": { en: "View Tools", ja: "ツールを見る" },
  "看文章": { en: "Read Articles", ja: "記事を見る" },
  "看 AI 情報": { en: "Read AI News", ja: "AI情報を見る" },
  "AI 工具": { en: "AI Tools", ja: "AIツール" },
  "學習文章": { en: "Learning Articles", ja: "学習記事" },
  "這裡分成四個清楚入口。": { en: "Four clear ways to explore.", ja: "4つの入口から探索できます。" },
  "從 14 年軍旅，到 AI 時代重新開始。": { en: "A new start in the AI era after 14 years of military service.", ja: "14年間の軍歴を経て、AI時代に再出発。" },
  "我是詹棋庭，可以叫我詹姆士（James）": { en: "I am James Chan.", ja: "ジェームズです。" },
  "我親手做出來的 AI 工具": { en: "AI tools I built and curated", ja: "自分で作り、厳選したAIツール" },
  "AI 學習文章與實作筆記": { en: "AI learning articles and build notes", ja: "AI学習記事と実践ノート" },
  "AI 筆電購買清單": { en: "AI Laptop Buying List", ja: "AIノートPC購入リスト" },
  "下載中心": { en: "Download Center", ja: "ダウンロードセンター" },
  "會員中心": { en: "Member Center", ja: "会員センター" },
  "內容管理系統 MVP": { en: "Content Management System MVP", ja: "コンテンツ管理システム MVP" },
  "AI 小幫手": { en: "AI Assistant", ja: "AIアシスタント" },
  "AI 客服小幫手": { en: "AI Support Assistant", ja: "AIサポートアシスタント" },
  "你好！有什麼需要幫忙的嗎？": { en: "Hi! How can I help?", ja: "こんにちは！何をお手伝いできますか？" },
  "問我：James 的 AI 工具、文章、情報或聯絡方式": { en: "Ask about James's AI tools, articles, news, or contact details", ja: "AIツール、記事、情報、連絡先について質問してください" },
  "送出": { en: "Send", ja: "送信" },
  "常見問題": { en: "FAQ", ja: "よくある質問" },
  "AI 新手入門": { en: "AI for Beginners", ja: "AI入門" },
  "推薦 AI 工具": { en: "Recommend AI Tools", ja: "AIツール推薦" },
  "AI 教學文章": { en: "AI Tutorials", ja: "AI記事" },
  "聯絡 James": { en: "Contact James", ja: "Jamesに連絡" },
  "返回首頁": { en: "Back Home", ja: "ホームへ戻る" },
  "閱讀全文": { en: "Read more", ja: "全文を読む" },
  "來源": { en: "Source", ja: "出典" },
  "摘要": { en: "Summary", ja: "要約" },
};

export function translateSiteText(text: string, language: SiteLanguage) {
  if (language === "zh-Hant") return text;
  return translations[text]?.[language] ?? text;
}
