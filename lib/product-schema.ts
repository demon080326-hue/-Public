import type { ProductStatus, ProductStockStatus, ProductType } from "@/types/database";

// Client-safe product catalog constants, labels, and pure validation shared by the
// admin API (authoritative) and the admin form (light client-side checks).

export const PRODUCT_TYPE_KEYS: ProductType[] = ["course", "digital", "physical", "service", "food", "other"];
export const PRODUCT_STATUS_KEYS: ProductStatus[] = ["draft", "published", "archived"];
export const STOCK_STATUS_KEYS: ProductStockStatus[] = ["in_stock", "out_of_stock", "preorder", "unlimited"];

export const PRODUCT_TYPE_LABELS: Record<ProductType, string> = {
  course: "課程",
  digital: "數位商品",
  physical: "實體商品",
  service: "服務",
  food: "食品",
  other: "其他",
};

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  draft: "草稿",
  published: "已發布",
  archived: "已下架",
};

export const STOCK_STATUS_LABELS: Record<ProductStockStatus, string> = {
  in_stock: "有庫存",
  out_of_stock: "缺貨",
  preorder: "預購",
  unlimited: "無限量",
};

export const MAX_PRICE_CENTS = 100_000_000; // NT$1,000,000.00 upper guard.
export const MAX_SORT_ORDER = 1_000_000;
export const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isProductType(value: unknown): value is ProductType {
  return typeof value === "string" && (PRODUCT_TYPE_KEYS as string[]).includes(value);
}

export function isProductStatus(value: unknown): value is ProductStatus {
  return typeof value === "string" && (PRODUCT_STATUS_KEYS as string[]).includes(value);
}

export function isStockStatus(value: unknown): value is ProductStockStatus {
  return typeof value === "string" && (STOCK_STATUS_KEYS as string[]).includes(value);
}

export function isValidSlug(value: string) {
  return value.length >= 1 && value.length <= 160 && SLUG_PATTERN.test(value);
}

export function slugify(value: string) {
  return value
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

export function formatPriceTWD(cents: number) {
  const dollars = Math.round(cents) / 100;
  return new Intl.NumberFormat("zh-TW", {
    style: "currency",
    currency: "TWD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(dollars);
}

export type ProductWritableFields = {
  slug: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  product_type: ProductType;
  category: string | null;
  price_cents: number;
  compare_at_price_cents: number | null;
  currency: "TWD";
  image_url: string | null;
  status: ProductStatus;
  stock_status: ProductStockStatus;
  inventory_quantity: number | null;
  is_featured: boolean;
  sort_order: number;
};

export type ProductValidationOk<T> = { ok: true; values: T };
export type ProductValidationError = { ok: false; code: string; message: string };

function fail(code: string, message: string): ProductValidationError {
  return { ok: false, code, message };
}

function optionalText(value: unknown, max: number): string | null {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text.slice(0, max) : null;
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function parseIntegerLike(value: unknown): number | null {
  if (typeof value === "number") return Number.isInteger(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
  }
  return null;
}

function parseBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === "on" || value === 1 || value === "1";
}

// Validates one field name from a raw record, returning either an error or the normalized value.
function validateField(
  key: keyof ProductWritableFields,
  body: Record<string, unknown>,
): ProductValidationError | { ok: true; value: ProductWritableFields[keyof ProductWritableFields] } {
  switch (key) {
    case "slug": {
      const slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
      if (!isValidSlug(slug)) {
        return fail("INVALID_SLUG", "slug 需為小寫英數與連字號（例如 my-product），長度 1-160。");
      }
      return { ok: true, value: slug };
    }
    case "name": {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (name.length < 1 || name.length > 200) return fail("INVALID_NAME", "商品名稱需為 1-200 字。");
      return { ok: true, value: name };
    }
    case "subtitle":
      return { ok: true, value: optionalText(body.subtitle, 200) };
    case "description":
      return { ok: true, value: optionalText(body.description, 5000) };
    case "category":
      return { ok: true, value: optionalText(body.category, 100) };
    case "product_type": {
      const type = body.product_type;
      if (!isProductType(type)) return fail("INVALID_PRODUCT_TYPE", "請選擇合法的商品類型。");
      return { ok: true, value: type };
    }
    case "status": {
      const status = body.status;
      if (!isProductStatus(status)) return fail("INVALID_STATUS", "狀態只能是 draft / published / archived。");
      return { ok: true, value: status };
    }
    case "stock_status": {
      const stock = body.stock_status;
      if (!isStockStatus(stock)) return fail("INVALID_STOCK_STATUS", "請選擇合法的庫存狀態。");
      return { ok: true, value: stock };
    }
    case "price_cents": {
      const price = parseIntegerLike(body.price_cents);
      if (price === null || price < 0 || price > MAX_PRICE_CENTS) {
        return fail("INVALID_PRICE", "價格需為 0 以上的整數（單位：分）。");
      }
      return { ok: true, value: price };
    }
    case "compare_at_price_cents": {
      if (body.compare_at_price_cents === undefined || body.compare_at_price_cents === null || body.compare_at_price_cents === "") {
        return { ok: true, value: null };
      }
      const compare = parseIntegerLike(body.compare_at_price_cents);
      if (compare === null || compare < 0 || compare > MAX_PRICE_CENTS) {
        return fail("INVALID_COMPARE_PRICE", "原價需為 0 以上的整數（單位：分）。");
      }
      return { ok: true, value: compare };
    }
    case "inventory_quantity": {
      if (body.inventory_quantity === undefined || body.inventory_quantity === null || body.inventory_quantity === "") {
        return { ok: true, value: null };
      }
      const qty = parseIntegerLike(body.inventory_quantity);
      if (qty === null || qty < 0 || qty > 10_000_000) return fail("INVALID_INVENTORY", "庫存數量需為 0 以上的整數。");
      return { ok: true, value: qty };
    }
    case "is_featured":
      return { ok: true, value: parseBoolean(body.is_featured) };
    case "sort_order": {
      if (body.sort_order === undefined || body.sort_order === null || body.sort_order === "") {
        return { ok: true, value: 0 };
      }
      const order = parseIntegerLike(body.sort_order);
      if (order === null || order < 0 || order > MAX_SORT_ORDER) return fail("INVALID_SORT_ORDER", "排序值需為 0 以上的整數。");
      return { ok: true, value: order };
    }
    case "image_url": {
      const raw = optionalText(body.image_url, 2048);
      if (raw && !isHttpUrl(raw)) return fail("INVALID_IMAGE_URL", "圖片網址需以 http:// 或 https:// 開頭。");
      return { ok: true, value: raw };
    }
    case "currency":
      return { ok: true, value: "TWD" };
    default:
      return fail("INVALID_FIELD", "未知欄位。");
  }
}

const ALL_FIELDS: (keyof ProductWritableFields)[] = [
  "slug",
  "name",
  "subtitle",
  "description",
  "product_type",
  "category",
  "price_cents",
  "compare_at_price_cents",
  "currency",
  "image_url",
  "status",
  "stock_status",
  "inventory_quantity",
  "is_featured",
  "sort_order",
];

export function validateProductCreate(
  value: unknown,
): ProductValidationOk<ProductWritableFields> | ProductValidationError {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fail("INVALID_BODY", "請提供完整的商品資料。");
  }
  const body = value as Record<string, unknown>;
  const output = {} as Record<string, unknown>;

  for (const key of ALL_FIELDS) {
    const result = validateField(key, body);
    if (!result.ok) return result;
    output[key] = result.value;
  }

  return { ok: true, values: output as unknown as ProductWritableFields };
}

// Update accepts only the fields that are present; slug/name are validated when provided but not required.
export function validateProductUpdate(
  value: unknown,
): ProductValidationOk<Partial<ProductWritableFields>> | ProductValidationError {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fail("INVALID_BODY", "請提供要更新的商品欄位。");
  }
  const body = value as Record<string, unknown>;
  const output: Partial<ProductWritableFields> = {};
  let touched = 0;

  for (const key of ALL_FIELDS) {
    if (key === "currency") continue; // currency is fixed to TWD and never patched.
    if (!(key in body)) continue;
    const result = validateField(key, body);
    if (!result.ok) return result;
    (output as Record<string, unknown>)[key] = result.value;
    touched += 1;
  }

  if (touched === 0) return fail("EMPTY_UPDATE", "沒有任何可更新的欄位。");
  return { ok: true, values: output };
}
