import { getSupabaseServerClient } from "@/lib/supabase/server";

export type AuthUserSummary = {
  id: string;
  email: string;
  emailVerified: boolean;
};

export async function getAuthUserSummary(): Promise<AuthUserSummary | null> {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user?.email) return null;

  return {
    id: data.user.id,
    email: data.user.email,
    emailVerified: Boolean(data.user.email_confirmed_at),
  };
}
