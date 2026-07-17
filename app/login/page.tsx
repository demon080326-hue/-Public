import { MemberAuthHub } from "@/components/member-auth-hub";
import { getCurrentMemberContext } from "@/lib/member-profile";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const [member, params] = await Promise.all([getCurrentMemberContext(), searchParams]);
  const noticeValue = first(params.notice);
  const errorValue = first(params.error);
  const initialNotice = noticeValue === "admin-auth-required"
    ? noticeValue
    : errorValue === "auth_callback_failed" || errorValue === "auth-unavailable"
      ? errorValue
      : null;

  return <MemberAuthHub initialUser={member?.user ?? null} initialProfile={member?.profile ?? null} profileStatus={member?.profileStatus ?? null} initialNotice={initialNotice} />;
}
