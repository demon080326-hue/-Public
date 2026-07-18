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
  const [member, params] = await Promise.all([
    getCurrentMemberContext({ syncProfileFromAuth: true }),
    searchParams,
  ]);
  const noticeValue = first(params.notice);
  const errorValue = first(params.error);
  const initialNotice = noticeValue === "admin-auth-required"
    ? noticeValue
    : noticeValue === "reverification-required"
      ? noticeValue
    : noticeValue === "reverification-passed"
      ? noticeValue
    : errorValue === "auth_callback_failed" || errorValue === "auth-unavailable"
      ? errorValue
      : null;

  return <MemberAuthHub initialUser={member?.user ?? null} initialProfile={member?.profile ?? null} profileStatus={member?.profileStatus ?? null} initialSecurityState={member?.securityState ?? null} securityStatus={member?.securityStatus ?? null} initialNotice={initialNotice} />;
}
