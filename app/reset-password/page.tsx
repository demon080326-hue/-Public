import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/reset-password-form";

export const metadata: Metadata = {
  title: "設定新密碼｜重啟實驗室",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default function ResetPasswordPage() {
  return (
    <section className="member-hub-section auth-section">
      <div className="wrap member-hub">
        <div className="member-hub-heading">
          <span className="tag">PASSWORD RECOVERY</span>
          <h1>設定新密碼</h1>
          <p>請輸入新的密碼。完成後系統會登出目前 recovery session，請回登入頁使用新密碼登入。</p>
        </div>
        <ResetPasswordForm />
      </div>
    </section>
  );
}
