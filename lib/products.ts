import "server-only";

import { getSupabaseAdminClient } from "@/lib/supabase-admin";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { isProductStatus, isProductType } from "@/lib/product-schema";
import type { ProductWritableFields } from "@/lib/product-schema";
import type { ProductRow, ProductStatus, ProductType } from "@/types/database";

// Columns that are safe to expose to the public storefront (never metadata / created_by / updated_by).
const PUBLIC_PRODUCT_FIELDS =
  "id,slug,name,subtitle,description,product_type,category,price_cents,compare_at_price_cents,currency,image_url,status,stock_status,is_featured,sort_order,created_at";

const ADMIN_PRODUCT_FIELDS =
  "id,slug,name,subtitle,description,product_type,category,price_cents,compare_at_price_cents,currency,image_url,status,stock_status,inventory_quantity,is_featured,sort_order,created_by,updated_by,created_at,updated_at";

export type PublicProduct = Pick<
  ProductRow,
  | "id"
  | "slug"
  | "name"
  | "subtitle"
  | "description"
  | "product_type"
  | "category"
  | "price_cents"
  | "compare_at_price_cents"
  | "currency"
  | "image_url"
  | "status"
  | "stock_status"
  | "is_featured"
  | "sort_order"
  | "created_at"
>;

export type AdminProductListItem = Omit<ProductRow, "metadata">;

export type AdminProductListFilters = {
  search: string;
  status: ProductStatus | null;
  productType: ProductType | null;
  page: number;
  limit: number;
};

export type AdminProductStatusCounts = Record<ProductStatus, number>;

export type AdminProductListResult = {
  products: AdminProductListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  statusCounts: AdminProductStatusCounts;
};

export class ProductError extends Error {
  constructor(
    public readonly code: "SERVICE_UNAVAILABLE" | "SLUG_TAKEN" | "NOT_FOUND" | "QUERY_FAILED" | "WRITE_FAILED",
    message: string,
  ) {
    super(message);
    this.name = "ProductError";
  }
}

export function isValidProductId(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function isDuplicateSlugError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  return error.code === "23505" || /duplicate key|already exists|unique/i.test(error.message ?? "");
}

// --- Public storefront read (anon client, RLS restricts to published rows) ---

export async function getPublishedProducts(limit = 48): Promise<PublicProduct[]> {
  try {
    const supabase = await getSupabaseServerClient();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from("products")
      .select(PUBLIC_PRODUCT_FIELDS)
      .eq("status", "published")
      .order("is_featured", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      // Graceful storefront fallback (e.g. products table not migrated yet); not a hard error.
      console.warn("Published products unavailable:", { code: error.code, message: error.message });
      return [];
    }

    return (data ?? []) as unknown as PublicProduct[];
  } catch (error) {
    console.warn("Published products read skipped:", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return [];
  }
}

// --- Admin filters ---

function firstValue(value: string | string[] | null | undefined) {
  return Array.isArray(value) ? value[0] : value ?? undefined;
}

function positiveInteger(value: string | undefined, fallback: number) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function escapeIlike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export function normalizeAdminProductFilters(
  input: Record<string, string | string[] | undefined> | URLSearchParams,
): AdminProductListFilters {
  const read = (name: string) =>
    input instanceof URLSearchParams ? input.get(name) ?? undefined : firstValue(input[name]);
  const status = read("status");
  const productType = read("product_type");

  return {
    search: (read("search") ?? "").trim().slice(0, 200),
    status: isProductStatus(status) ? status : null,
    productType: isProductType(productType) ? productType : null,
    page: Math.min(positiveInteger(read("page"), 1), 10_000),
    limit: Math.min(positiveInteger(read("limit"), 20), 50),
  };
}

const PRODUCT_STATUS_LIST: ProductStatus[] = ["draft", "published", "archived"];

export async function getAdminProductList(filters: AdminProductListFilters): Promise<AdminProductListResult> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new ProductError("SERVICE_UNAVAILABLE", "商品服務目前無法使用。");

  const from = (filters.page - 1) * filters.limit;
  const to = from + filters.limit - 1;

  let query = supabase
    .from("products")
    .select(ADMIN_PRODUCT_FIELDS, { count: "exact" })
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (filters.search) {
    const safe = escapeIlike(filters.search);
    query = query.or(`name.ilike.%${safe}%,slug.ilike.%${safe}%`);
  }
  if (filters.status) query = query.eq("status", filters.status);
  if (filters.productType) query = query.eq("product_type", filters.productType);

  const [listResult, ...statusResults] = await Promise.all([
    query,
    ...PRODUCT_STATUS_LIST.map((status) =>
      supabase.from("products").select("id", { count: "exact", head: true }).eq("status", status),
    ),
  ]);

  if (listResult.error) {
    console.error("Admin product list query failed:", { code: listResult.error.code, message: listResult.error.message });
    throw new ProductError("QUERY_FAILED", "無法查詢商品資料。");
  }

  const failedStatus = statusResults.find((result) => result.error);
  if (failedStatus?.error) {
    console.error("Admin product status count failed:", { code: failedStatus.error.code, message: failedStatus.error.message });
    throw new ProductError("QUERY_FAILED", "無法統計商品狀態。");
  }

  const statusCounts = Object.fromEntries(
    PRODUCT_STATUS_LIST.map((status, index) => [status, statusResults[index].count ?? 0]),
  ) as AdminProductStatusCounts;
  const total = listResult.count ?? 0;

  return {
    products: (listResult.data ?? []) as unknown as AdminProductListItem[],
    total,
    page: filters.page,
    limit: filters.limit,
    totalPages: Math.max(1, Math.ceil(total / filters.limit)),
    statusCounts,
  };
}

export async function getAdminProductById(id: string): Promise<AdminProductListItem | null> {
  if (!isValidProductId(id)) return null;

  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new ProductError("SERVICE_UNAVAILABLE", "商品服務目前無法使用。");

  const { data, error } = await supabase.from("products").select(ADMIN_PRODUCT_FIELDS).eq("id", id).maybeSingle();

  if (error) {
    console.error("Admin product detail query failed:", { code: error.code, message: error.message });
    throw new ProductError("QUERY_FAILED", "無法讀取商品資料。");
  }

  return (data as unknown as AdminProductListItem) ?? null;
}

export async function createProduct(
  values: ProductWritableFields,
  actorUserId: string,
): Promise<AdminProductListItem> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new ProductError("SERVICE_UNAVAILABLE", "商品服務目前無法使用。");

  const { data, error } = await supabase
    .from("products")
    .insert({
      ...values,
      created_by: actorUserId,
      updated_by: actorUserId,
    })
    .select(ADMIN_PRODUCT_FIELDS)
    .single();

  if (error) {
    if (isDuplicateSlugError(error)) throw new ProductError("SLUG_TAKEN", "這個 slug 已經被使用，請換一個。");
    console.error("Product create failed:", { code: error.code, message: error.message });
    throw new ProductError("WRITE_FAILED", "商品建立失敗，請稍後再試。");
  }

  return data as unknown as AdminProductListItem;
}

export async function updateProduct(
  id: string,
  values: Partial<ProductWritableFields>,
  actorUserId: string,
): Promise<{ before: AdminProductListItem; after: AdminProductListItem }> {
  const supabase = getSupabaseAdminClient();
  if (!supabase) throw new ProductError("SERVICE_UNAVAILABLE", "商品服務目前無法使用。");

  const before = await getAdminProductById(id);
  if (!before) throw new ProductError("NOT_FOUND", "找不到商品資料。");

  const { data, error } = await supabase
    .from("products")
    .update({
      ...values,
      updated_by: actorUserId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(ADMIN_PRODUCT_FIELDS)
    .single();

  if (error) {
    if (isDuplicateSlugError(error)) throw new ProductError("SLUG_TAKEN", "這個 slug 已經被使用，請換一個。");
    console.error("Product update failed:", { code: error.code, message: error.message });
    throw new ProductError("WRITE_FAILED", "商品更新失敗，請稍後再試。");
  }

  return { before, after: data as unknown as AdminProductListItem };
}
