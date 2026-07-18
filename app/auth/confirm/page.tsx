import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "確認 Email｜重啟實驗室",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type ConfirmEmailPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function ConfirmEmailPage({ searchParams }: ConfirmEmailPageProps) {
  const params = await searchParams;
  const tokenHash = first(params.token_hash);
  const type = first(params.type);
  const next = first(params.next) ?? "/member";
  const validRequest = Boolean(tokenHash && type);

  return (
    <section className="member-hub-section auth-section">
      <div className="wrap member-hub">
        <div className="member-hub-heading">
          <span className="tag">EMAIL CONFIRMATION</span>
          <h1>確認你的 Email</h1>
          <p>請按下按鈕完成信箱驗證。這個額外步驟可避免郵件預覽服務提前使用一次性驗證連結。</p>
        </div>

        <article className="member-hub-card auth-user-card">
          {validRequest ? (
            <form action="/auth/callback" method="post" className="auth-form">
              <input type="hidden" name="token_hash" value={tokenHash} />
              <input type="hidden" name="type" value={type} />
              <input type="hidden" name="next" value={next} />
              <p>驗證完成後，你會前往會員中心。一次性連結若已過期，請回登入頁重新申請。</p>
              <button className="btn" type="submit">確認 Email</button>
            </form>
          ) : (
            <div>
              <h2>驗證連結無效</h2>
              <p>這個連結缺少必要資料，請回登入頁重新註冊或申請驗證信。</p>
              <Link className="btn" href="/login">返回會員登入</Link>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}
