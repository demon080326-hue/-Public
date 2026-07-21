import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/admin-access";
import { writeAdminAuditLog } from "@/lib/admin-audit-log";
import { validateProductUpdate } from "@/lib/product-schema";
import { getAdminProductById, isValidProductId, ProductError, updateProduct } from "@/lib/products";
import type { AdminProductListItem } from "@/lib/products";

export const runtime = "nodejs";

type ProductRouteProps = {
  params: Promise<{ id: string }>;
};

function accessError(status: string) {
  if (status === "unauthenticated") {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", message: "請先登入管理員帳號。" }, { status: 401 });
  }
  return NextResponse.json({ ok: false, code: "ADMIN_REQUIRED", message: "此功能僅限 admin 或 owner 使用。" }, { status: 403 });
}

function auditSummary(product: AdminProductListItem) {
  return { slug: product.slug, name: product.name, status: product.status, price_cents: product.price_cents, product_type: product.product_type };
}

export async function GET(request: NextRequest, { params }: ProductRouteProps) {
  const access = await requireAdminAccess();
  if (access.status !== "allowed") return accessError(access.status);

  const { id } = await params;
  if (!isValidProductId(id)) {
    return NextResponse.json({ ok: false, code: "INVALID_PRODUCT_ID", message: "商品 ID 格式不正確。" }, { status: 400 });
  }

  try {
    const product = await getAdminProductById(id);
    if (!product) {
      return NextResponse.json({ ok: false, code: "PRODUCT_NOT_FOUND", message: "找不到商品資料。" }, { status: 404 });
    }
    return NextResponse.json({ ok: true, product });
  } catch (error) {
    if (error instanceof ProductError) {
      const status = error.code === "SERVICE_UNAVAILABLE" ? 503 : 500;
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
    }
    console.error("Admin product detail API failed:", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, code: "PRODUCT_DETAIL_FAILED", message: "目前無法讀取商品資料。" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: ProductRouteProps) {
  const access = await requireAdminAccess();
  if (access.status !== "allowed") return accessError(access.status);
  if (!access.user || !access.role) {
    return NextResponse.json({ ok: false, code: "ADMIN_IDENTITY_MISSING", message: "無法確認管理員身分。" }, { status: 500 });
  }

  const { id } = await params;
  if (!isValidProductId(id)) {
    return NextResponse.json({ ok: false, code: "INVALID_PRODUCT_ID", message: "商品 ID 格式不正確。" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "請提供有效的 JSON 資料。" }, { status: 400 });
  }

  const validation = validateProductUpdate(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, code: validation.code, message: validation.message }, { status: 400 });
  }

  try {
    const { before, after } = await updateProduct(id, validation.values, access.user.id);

    // Archiving (status -> archived) is a soft delete; log it as product_archive, otherwise product_update.
    const isArchive = validation.values.status === "archived" && before.status !== "archived";

    const auditWritten = await writeAdminAuditLog({
      actor: { userId: access.user.id, email: access.user.email, role: access.role },
      action: isArchive ? "product_archive" : "product_update",
      resourceType: "product",
      resourceId: after.id,
      beforeData: auditSummary(before),
      afterData: auditSummary(after),
      metadata: {
        stage: "stage14_products",
        changed_fields: Object.keys(validation.values),
        archived: isArchive,
      },
      request,
    });
    if (!auditWritten) console.error("Product update audit log was not written:", { productId: after.id });

    return NextResponse.json({ ok: true, product: after });
  } catch (error) {
    if (error instanceof ProductError) {
      const status =
        error.code === "NOT_FOUND" ? 404 : error.code === "SLUG_TAKEN" ? 409 : error.code === "SERVICE_UNAVAILABLE" ? 503 : 500;
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
    }
    console.error("Admin product update API failed:", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, code: "PRODUCT_UPDATE_FAILED", message: "商品更新失敗，請稍後再試。" }, { status: 500 });
  }
}
