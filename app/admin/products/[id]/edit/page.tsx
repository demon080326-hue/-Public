import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminAccessNotice } from "@/components/admin-access-notice";
import { AdminProductForm } from "@/components/admin-product-form";
import { requireAdminAccess } from "@/lib/admin-access";
import { getAdminProductById, isValidProductId, ProductError } from "@/lib/products";
import type { AdminProductListItem } from "@/lib/products";

export const dynamic = "force-dynamic";

type EditProductPageProps = {
  params: Promise<{ id: string }>;
};

function ProductLookupError({ message }: { message: string }) {
  return (
    <section className="access-notice-section">
      <div className="wrap access-notice">
        <span className="tag">ADMIN ONLY</span>
        <h1>商品編輯</h1>
        <p>{message}</p>
        <Link className="btn secondary" href="/admin/products">返回商品列表</Link>
      </div>
    </section>
  );
}

export default async function EditProductPage({ params }: EditProductPageProps) {
  const access = await requireAdminAccess();
  if (access.status === "unauthenticated") redirect("/login?notice=admin-auth-required");
  if (access.status !== "allowed") return <AdminAccessNotice page="dashboard" state={access} />;

  const { id } = await params;
  if (!isValidProductId(id)) return <ProductLookupError message="商品 ID 格式不正確。" />;

  let product: AdminProductListItem | null = null;
  let errorMessage: string | null = null;
  try {
    product = await getAdminProductById(id);
  } catch (caught) {
    errorMessage = caught instanceof ProductError ? caught.message : "目前無法讀取商品資料，請稍後再試。";
  }

  if (errorMessage) return <ProductLookupError message={errorMessage} />;
  if (!product) return <ProductLookupError message="找不到商品資料。" />;

  return (
    <>
      <section className="page-hero admin-member-hero">
        <div className="wrap">
          <p className="eyebrow">Admin Products</p>
          <h1>編輯商品</h1>
          <p className="page-copy">{product.name} · {product.slug} · {product.status}</p>
        </div>
      </section>
      <section className="section admin-member-section">
        <div className="wrap"><AdminProductForm mode="edit" product={product} /></div>
      </section>
    </>
  );
}
