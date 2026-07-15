export type NewsCategory = "openai" | "claude" | "google" | "meta" | "microsoft" | "apple" | "research" | "other" | string;
export type ReviewStatus = "pending" | "approved" | "rejected" | "spam" | "duplicate" | "needs_review";

export type NewsItem = {
  id: string;
  fingerprint: string;
  title_original: string;
  title_zh: string;
  summary_short: string | null;
  summary_full: string | null;
  why_it_matters: string | null;
  source_name: string;
  source_url: string;
  canonical_url: string | null;
  company: string;
  category: NewsCategory;
  tags: string[];
  language: string;
  published_at: string | null;
  importance_score: number;
  confidence_score: number;
  quality_score: number;
  is_breaking: boolean;
  is_duplicate: boolean;
  is_spam: boolean;
  is_verified: boolean;
  is_published: boolean;
  review_status: ReviewStatus;
  image_url?: string | null;
};

export type AiNewsRow = {
  id: string;
  source_id: string | null;
  title: string | null;
  summary: string | null;
  content: string | null;
  url: string | null;
  image_url: string | null;
  author: string | null;
  published_at: string | null;
  category: string | null;
  tags: string[] | null;
  language: string | null;
  ai_score: number | null;
  created_at: string | null;
  updated_at: string | null;
};

export type Database = {
  public: {
    Tables: {
      ai_news: {
        Row: AiNewsRow;
        Insert: Partial<AiNewsRow> & Pick<AiNewsRow, "title" | "url">;
        Update: Partial<AiNewsRow>;
        Relationships: [];
      };
      ai_sources: {
        Row: {
          id: string;
          name: string;
          company: string;
          url: string;
          feed_url: string | null;
          enabled: boolean;
          official: boolean;
          category: string;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_sources"]["Row"]> & Pick<Database["public"]["Tables"]["ai_sources"]["Row"], "id" | "name" | "url">;
        Update: Partial<Database["public"]["Tables"]["ai_sources"]["Row"]>;
        Relationships: [];
      };
      ai_digests: {
        Row: {
          id: string;
          title: string;
          slug: string;
          intro: string | null;
          executive_summary: string | null;
          period_start: string;
          period_end: string;
          total_items: number;
          article_url: string | null;
          published_at: string | null;
          is_published: boolean;
        };
        Insert: Partial<Database["public"]["Tables"]["ai_digests"]["Row"]> & Pick<Database["public"]["Tables"]["ai_digests"]["Row"], "title" | "slug" | "period_start" | "period_end">;
        Update: Partial<Database["public"]["Tables"]["ai_digests"]["Row"]>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
