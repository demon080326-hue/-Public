import { redirect } from "next/navigation";
import { AdminAccessNotice } from "@/components/admin-access-notice";
import { AdminProductForm } from "@/components/admin-product-form";
import { requireAdminAccess } from "@/lib/admin-access";

export const dynamic = "force-dynamic";

export default async function NewProductPage() {
  const access = await requireAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?notice=admin-auth-required");
  if (access.status !== "allowed") return <AdminAccessNotice page="dashboard" state={access} />;

  return (
    <>
      <section className="page-hero admin-member-hero">
        <div className="wrap">
          <p className="eyebrow">Admin Products</p>
          <h1>新增商品</h1>
          <p className="page-copy">建立一筆商品資料。存成 draft 不會出現在前台，設為 published 才會顯示於 /shop。</p>
        </div>
      </section>
      <section className="section admin-member-section">
        <div className="wrap"><AdminProductForm mode="create" /></div>
      </section>
    </>
  );
}
