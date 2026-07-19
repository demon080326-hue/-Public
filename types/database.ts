export type NewsCategory = "openai" | "claude" | "google" | "meta" | "microsoft" | "apple" | "research" | "other" | string;
export type ReviewStatus = "pending" | "approved" | "rejected" | "spam" | "duplicate" | "needs_review";

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

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

export type MemberRole = "pending_member" | "member" | "admin" | "owner";
export type MemberTierKey = "super_poor" | "poor" | "commoner" | "merchant" | "noble" | "royal_citizen" | "royal_relative" | "royal_direct" | "king";
export type MemberAccountStatus = "normal" | "suspended" | "restricted";
export type MemberPointsSourceType =
  | "daily_checkin"
  | "streak_bonus_7_days"
  | "monthly_full_checkin_bonus"
  | "yearly_full_checkin_bonus"
  | "purchase_reward"
  | "admin_adjustment"
  | "redemption"
  | "refund_reversal"
  | "migration";
export type MemberTierHistoryReason =
  | "signup"
  | "email_verified"
  | "points_upgrade"
  | "spend_upgrade"
  | "inactivity_downgrade"
  | "manual_adjustment"
  | "refund_recalculation"
  | "restore_after_purchase";

export type ProfileRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: MemberRole;
  email_verified: boolean;
  points_balance: number;
  current_tier: MemberTierKey;
  highest_tier: MemberTierKey;
  minimum_tier: MemberTierKey;
  lifetime_earned_points: number;
  lifetime_redeemed_points: number;
  total_valid_spend: number;
  last_valid_purchase_at: string | null;
  downgrade_exempt: boolean;
  upgrade_disabled: boolean;
  account_status: MemberAccountStatus;
  created_at: string;
  updated_at: string;
};

export type MemberTierSettingsRow = {
  id: string;
  tier_key: MemberTierKey;
  tier_name: string;
  sort_order: number;
  required_valid_spend: number;
  required_lifetime_points: number;
  is_manual_only: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type MemberTierHistoryRow = {
  id: string;
  user_id: string;
  old_tier: MemberTierKey | null;
  new_tier: MemberTierKey;
  reason: MemberTierHistoryReason;
  changed_by: string | null;
  metadata: Json;
  created_at: string;
};

export type MemberPointsLedgerRow = {
  id: string;
  user_id: string;
  amount: number;
  balance_after: number;
  lifetime_earned_after: number;
  source_type: MemberPointsSourceType;
  note: string | null;
  checkin_date: string | null;
  metadata: Json;
  created_at: string;
};

export type AuthSecurityStateRow = {
  user_id: string;
  failed_login_count: number;
  requires_reverification: boolean;
  locked_until: string | null;
  last_failed_login_at: string | null;
  last_successful_login_at: string | null;
  created_at: string;
  updated_at: string;
};

export type LoginAttemptRow = {
  id: string;
  user_id: string | null;
  email_hash: string;
  ip_hash: string | null;
  user_agent: string | null;
  success: boolean;
  reason: string | null;
  created_at: string;
};

export type AuthSecurityEventRow = {
  id: string;
  user_id: string | null;
  event_type: string;
  metadata: Json;
  created_at: string;
};

export type EmailVerificationCodeRow = {
  id: string;
  user_id: string;
  purpose: "login_reverification" | "email_verification" | "password_reset";
  code_hash: string;
  expires_at: string;
  consumed_at: string | null;
  attempts: number;
  max_attempts: number;
  created_at: string;
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
      profiles: {
        Row: ProfileRow;
        Insert: Partial<ProfileRow> & Pick<ProfileRow, "user_id">;
        Update: Pick<Partial<ProfileRow>, "display_name">;
        Relationships: [];
      };
      member_tier_settings: {
        Row: MemberTierSettingsRow;
        Insert: Partial<MemberTierSettingsRow> & Pick<MemberTierSettingsRow, "tier_key" | "tier_name" | "sort_order">;
        Update: Partial<MemberTierSettingsRow>;
        Relationships: [];
      };
      member_tier_history: {
        Row: MemberTierHistoryRow;
        Insert: Partial<MemberTierHistoryRow> & Pick<MemberTierHistoryRow, "user_id" | "new_tier" | "reason">;
        Update: Partial<MemberTierHistoryRow>;
        Relationships: [];
      };
      member_points_ledger: {
        Row: MemberPointsLedgerRow;
        Insert: Partial<MemberPointsLedgerRow> & Pick<MemberPointsLedgerRow, "user_id" | "amount" | "balance_after" | "lifetime_earned_after" | "source_type">;
        Update: Partial<MemberPointsLedgerRow>;
        Relationships: [];
      };
      auth_security_state: {
        Row: AuthSecurityStateRow;
        Insert: Partial<AuthSecurityStateRow> & Pick<AuthSecurityStateRow, "user_id">;
        Update: Partial<AuthSecurityStateRow>;
        Relationships: [];
      };
      login_attempts: {
        Row: LoginAttemptRow;
        Insert: Partial<LoginAttemptRow> & Pick<LoginAttemptRow, "email_hash">;
        Update: Partial<LoginAttemptRow>;
        Relationships: [];
      };
      auth_security_events: {
        Row: AuthSecurityEventRow;
        Insert: Partial<AuthSecurityEventRow> & Pick<AuthSecurityEventRow, "event_type">;
        Update: Partial<AuthSecurityEventRow>;
        Relationships: [];
      };
      email_verification_codes: {
        Row: EmailVerificationCodeRow;
        Insert: Partial<EmailVerificationCodeRow> & Pick<EmailVerificationCodeRow, "user_id" | "purpose" | "code_hash" | "expires_at">;
        Update: Partial<EmailVerificationCodeRow>;
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
    Functions: {
      get_current_user_profile: {
        Args: Record<PropertyKey, never>;
        Returns: ProfileRow[];
      };
      sync_own_profile_from_auth: {
        Args: Record<PropertyKey, never>;
        Returns: ProfileRow[];
      };
      claim_member_daily_checkin: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      record_auth_security_event: {
        Args: { p_user_id: string | null; p_event_type: string; p_metadata?: Json };
        Returns: string;
      };
      record_login_failure: {
        Args: { p_email_hash: string; p_ip_hash: string | null; p_user_agent: string | null; p_reason: string };
        Returns: Json;
      };
      record_login_success: {
        Args: { p_user_id: string; p_email_hash: string; p_ip_hash: string | null; p_user_agent: string | null };
        Returns: Json;
      };
      clear_reverification: {
        Args: { p_user_id: string };
        Returns: Json;
      };
      create_email_verification_code: {
        Args: { p_user_id: string; p_purpose: string; p_plain_code: string };
        Returns: string;
      };
      verify_email_verification_code: {
        Args: { p_user_id: string; p_purpose: string; p_plain_code: string };
        Returns: boolean;
      };
      get_reverification_target: {
        Args: { p_email_hash: string };
        Returns: { target_user_id: string; requires_reverification: boolean }[];
      };
      cancel_email_verification_code: {
        Args: { p_code_id: string; p_user_id: string; p_purpose: string };
        Returns: boolean;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};
