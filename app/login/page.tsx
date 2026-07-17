import { MemberAuthHub } from "@/components/member-auth-hub";
import { getAuthUserSummary } from "@/lib/auth-user";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [user, params] = await Promise.all([getAuthUserSummary(), searchParams]);
  const noticeValue = first(params.notice);
  const errorValue = first(params.error);
  const initialNotice = noticeValue === "admin-auth-required"
    ? noticeValue
    : errorValue === "auth_callback_failed" || errorValue === "auth-unavailable"
      ? errorValue
      : null;

  return <MemberAuthHub initialUser={user} initialNotice={initialNotice} />;
}
