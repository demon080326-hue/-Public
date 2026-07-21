import { NextRequest, NextResponse } from "next/server";
import { requireAdminAccess } from "@/lib/admin-access";
import { writeAdminAuditLog } from "@/lib/admin-audit-log";
import { validateProductCreate } from "@/lib/product-schema";
import { createProduct, getAdminProductList, normalizeAdminProductFilters, ProductError } from "@/lib/products";

export const runtime = "nodejs";

function accessError(status: string) {
  if (status === "unauthenticated") {
    return NextResponse.json({ ok: false, code: "AUTH_REQUIRED", message: "請先登入管理員帳號。" }, { status: 401 });
  }
  return NextResponse.json({ ok: false, code: "ADMIN_REQUIRED", message: "此功能僅限 admin 或 owner 使用。" }, { status: 403 });
}

export async function GET(request: NextRequest) {
  const access = await requireAdminAccess();
  if (access.status !== "allowed") return accessError(access.status);
  if (!access.user || !access.role) {
    return NextResponse.json({ ok: false, code: "ADMIN_IDENTITY_MISSING", message: "無法確認管理員身分。" }, { status: 500 });
  }

  const filters = normalizeAdminProductFilters(request.nextUrl.searchParams);

  try {
    const result = await getAdminProductList(filters);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    if (error instanceof ProductError) {
      const status = error.code === "SERVICE_UNAVAILABLE" ? 503 : 500;
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
    }
    console.error("Admin product list API failed:", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, code: "PRODUCT_LIST_FAILED", message: "目前無法查詢商品資料。" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const access = await requireAdminAccess();
  if (access.status !== "allowed") return accessError(access.status);
  if (!access.user || !access.role) {
    return NextResponse.json({ ok: false, code: "ADMIN_IDENTITY_MISSING", message: "無法確認管理員身分。" }, { status: 500 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, code: "INVALID_JSON", message: "請提供有效的 JSON 資料。" }, { status: 400 });
  }

  const validation = validateProductCreate(body);
  if (!validation.ok) {
    return NextResponse.json({ ok: false, code: validation.code, message: validation.message }, { status: 400 });
  }

  try {
    const product = await createProduct(validation.values, access.user.id);

    const auditWritten = await writeAdminAuditLog({
      actor: { userId: access.user.id, email: access.user.email, role: access.role },
      action: "product_create",
      resourceType: "product",
      resourceId: product.id,
      afterData: { slug: product.slug, name: product.name, status: product.status, price_cents: product.price_cents, product_type: product.product_type },
      metadata: { stage: "stage14_products", status: product.status },
      request,
    });
    if (!auditWritten) console.error("Product create audit log was not written:", { productId: product.id });

    return NextResponse.json({ ok: true, id: product.id, slug: product.slug, status: product.status }, { status: 201 });
  } catch (error) {
    if (error instanceof ProductError) {
      const status = error.code === "SLUG_TAKEN" ? 409 : error.code === "SERVICE_UNAVAILABLE" ? 503 : 500;
      return NextResponse.json({ ok: false, code: error.code, message: error.message }, { status });
    }
    console.error("Admin product create API failed:", { message: error instanceof Error ? error.message : "unknown" });
    return NextResponse.json({ ok: false, code: "PRODUCT_CREATE_FAILED", message: "商品建立失敗，請稍後再試。" }, { status: 500 });
  }
}
