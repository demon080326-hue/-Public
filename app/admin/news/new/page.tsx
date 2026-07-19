import { redirect } from "next/navigation";
import { AdminAccessNotice } from "@/components/admin-access-notice";
import { NewsForm } from "@/components/admin/news-form";
import { requireAdminAccess } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export default async function NewNewsPage() {
  const access = await requireAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?notice=admin-auth-required");
  if (access.status !== "allowed") return <AdminAccessNotice page="news" state={access} />;

  return (
    <>
      <section className="page-hero">
        <div className="wrap">
          <p className="eyebrow">AI News Admin</p>
          <h1>手動新增 AI 情報</h1>
          <p className="page-copy">管理員專用表單。AI 自動收集流程與 GitHub Actions 不會被這個頁面修改。</p>
        </div>
      </section>
      <section className="section">
        <div className="wrap">
          <NewsForm />
        </div>
      </section>
    </>
  );
}
