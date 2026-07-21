"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import {
  PRODUCT_STATUS_KEYS,
  PRODUCT_STATUS_LABELS,
  PRODUCT_TYPE_KEYS,
  PRODUCT_TYPE_LABELS,
  STOCK_STATUS_KEYS,
  STOCK_STATUS_LABELS,
  slugify,
} from "@/lib/product-schema";
import type { ProductStatus, ProductStockStatus, ProductType } from "@/types/database";
import type { AdminProductListItem } from "@/lib/products";

type Mode = "create" | "edit";

type FormState = {
  name: string;
  slug: string;
  subtitle: string;
  description: string;
  product_type: ProductType;
  category: string;
  priceTwd: string;
  compareAtTwd: string;
  image_url: string;
  status: ProductStatus;
  stock_status: ProductStockStatus;
  inventory_quantity: string;
  is_featured: boolean;
  sort_order: string;
};

type ApiResponse = { ok?: boolean; id?: string; code?: string; message?: string };

function centsToTwd(cents: number | null | undefined) {
  if (cents === null || cents === undefined) return "";
  return String(Math.round(cents) / 100);
}

function initialState(product?: AdminProductListItem): FormState {
  return {
    name: product?.name ?? "",
    slug: product?.slug ?? "",
    subtitle: product?.subtitle ?? "",
    description: product?.description ?? "",
    product_type: product?.product_type ?? "digital",
    category: product?.category ?? "",
    priceTwd: product ? centsToTwd(product.price_cents) : "",
    compareAtTwd: product ? centsToTwd(product.compare_at_price_cents) : "",
    image_url: product?.image_url ?? "",
    status: product?.status ?? "draft",
    stock_status: product?.stock_status ?? "in_stock",
    inventory_quantity: product?.inventory_quantity != null ? String(product.inventory_quantity) : "",
    is_featured: product?.is_featured ?? false,
    sort_order: product ? String(product.sort_order) : "0",
  };
}

function toCents(value: string): number {
  const dollars = Number(value);
  return Number.isFinite(dollars) ? Math.round(dollars * 100) : 0;
}

export function AdminProductForm({ mode, product }: { mode: Mode; product?: AdminProductListItem }) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(() => initialState(product));
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setState((current) => ({ ...current, [key]: value }));
  }

  function buildPayload() {
    const slug = state.slug.trim() ? state.slug.trim().toLowerCase() : slugify(state.name);
    return {
      name: state.name.trim(),
      slug,
      subtitle: state.subtitle.trim(),
      description: state.description.trim(),
      product_type: state.product_type,
      category: state.category.trim(),
      price_cents: toCents(state.priceTwd || "0"),
      compare_at_price_cents: state.compareAtTwd.trim() === "" ? null : toCents(state.compareAtTwd),
      image_url: state.image_url.trim(),
      status: state.status,
      stock_status: state.stock_status,
      inventory_quantity: state.inventory_quantity.trim() === "" ? null : Number(state.inventory_quantity),
      is_featured: state.is_featured,
      sort_order: state.sort_order.trim() === "" ? 0 : Number(state.sort_order),
    };
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setSubmitting(true);

    try {
      const payload = buildPayload();
      const url = mode === "create" ? "/api/admin/products" : `/api/admin/products/${encodeURIComponent(product!.id)}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as ApiResponse;

      if (!response.ok || data.ok !== true) {
        throw new Error(data.message || "商品儲存失敗，請稍後再試。");
      }

      if (mode === "create") {
        setCreatedId(data.id ?? null);
        setMessage({ kind: "success", text: "商品已建立。" });
      } else {
        setMessage({ kind: "success", text: "商品已更新。" });
        router.refresh();
      }
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "商品儲存失敗，請稍後再試。" });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchive() {
    if (!product) return;
    if (!window.confirm("確定要下架（archive）這個商品嗎？前台將不再顯示，但不會硬刪除。")) return;
    setMessage(null);
    setSubmitting(true);
    try {
      const response = await fetch(`/api/admin/products/${encodeURIComponent(product.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "archived" }),
      });
      const data = (await response.json()) as ApiResponse;
      if (!response.ok || data.ok !== true) throw new Error(data.message || "下架失敗，請稍後再試。");
      update("status", "archived");
      setMessage({ kind: "success", text: "商品已下架（archived）。" });
      router.refresh();
    } catch (error) {
      setMessage({ kind: "error", text: error instanceof Error ? error.message : "下架失敗，請稍後再試。" });
    } finally {
      setSubmitting(false);
    }
  }

  if (mode === "create" && createdId) {
    return (
      <section className="cms-panel admin-points-adjust-panel">
        <div className="cms-library-head"><div><p className="eyebrow">Product created</p><h2>商品已建立</h2></div><span className="cms-pill">draft/published</span></div>
        <p className="cms-help">商品已寫入 Supabase。你可以繼續編輯，或回到商品列表。發布狀態的商品會出現在前台 /shop。</p>
        <div className="admin-member-filter-actions">
          <Link className="btn" href={`/admin/products/${createdId}/edit`}>編輯這個商品</Link>
          <Link className="btn secondary" href="/admin/products">回到商品列表</Link>
          <Link className="btn secondary" href="/shop">查看前台商城</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="cms-panel admin-points-adjust-panel">
      <div className="cms-library-head">
        <div><p className="eyebrow">{mode === "create" ? "New product" : "Edit product"}</p><h2>{mode === "create" ? "新增商品" : "編輯商品"}</h2></div>
        <span className="cms-pill">管理員專用</span>
      </div>
      <p className="cms-help">本階段只做商品資料庫化與上下架，不含金流、訂單、購物車、點數折抵或下載解鎖。</p>

      <form className="admin-points-adjust-form" onSubmit={handleSubmit}>
        <label>
          商品名稱
          <input className="form-input" type="text" value={state.name} maxLength={200} required
            onChange={(event) => update("name", event.target.value)} />
        </label>

        <label>
          Slug（前台網址用，小寫英數與連字號）
          <input className="form-input" type="text" value={state.slug} maxLength={160} placeholder="例如 viral-short-video-kit"
            onChange={(event) => update("slug", event.target.value)} />
          <small>留空會自動由名稱產生（僅擷取英數）。建議手動填英文 slug。</small>
        </label>

        <label>
          副標題（選填）
          <input className="form-input" type="text" value={state.subtitle} maxLength={200}
            onChange={(event) => update("subtitle", event.target.value)} />
        </label>

        <label>
          商品描述（選填）
          <textarea rows={4} maxLength={5000} value={state.description}
            onChange={(event) => update("description", event.target.value)} />
        </label>

        <label>
          商品類型
          <select className="form-input" value={state.product_type}
            onChange={(event) => update("product_type", event.target.value as ProductType)}>
            {PRODUCT_TYPE_KEYS.map((key) => <option key={key} value={key}>{PRODUCT_TYPE_LABELS[key]}（{key}）</option>)}
          </select>
        </label>

        <label>
          分類（選填）
          <input className="form-input" type="text" value={state.category} maxLength={100}
            onChange={(event) => update("category", event.target.value)} />
        </label>

        <label>
          售價（TWD）
          <input className="form-input" type="number" min="0" step="1" value={state.priceTwd} required
            onChange={(event) => update("priceTwd", event.target.value)} />
          <small>以新台幣元為單位，系統會換算為 price_cents（分）。</small>
        </label>

        <label>
          原價／劃線價（TWD，選填）
          <input className="form-input" type="number" min="0" step="1" value={state.compareAtTwd}
            onChange={(event) => update("compareAtTwd", event.target.value)} />
        </label>

        <label>
          圖片網址（選填）
          <input className="form-input" type="url" value={state.image_url} placeholder="https://..."
            onChange={(event) => update("image_url", event.target.value)} />
        </label>

        <label>
          狀態
          <select className="form-input" value={state.status}
            onChange={(event) => update("status", event.target.value as ProductStatus)}>
            {PRODUCT_STATUS_KEYS.map((key) => <option key={key} value={key}>{PRODUCT_STATUS_LABELS[key]}（{key}）</option>)}
          </select>
          <small>只有 published 會出現在前台；draft、archived 不會。</small>
        </label>

        <label>
          庫存狀態
          <select className="form-input" value={state.stock_status}
            onChange={(event) => update("stock_status", event.target.value as ProductStockStatus)}>
            {STOCK_STATUS_KEYS.map((key) => <option key={key} value={key}>{STOCK_STATUS_LABELS[key]}（{key}）</option>)}
          </select>
        </label>

        <label>
          庫存數量（選填）
          <input className="form-input" type="number" min="0" step="1" value={state.inventory_quantity}
            onChange={(event) => update("inventory_quantity", event.target.value)} />
        </label>

        <label>
          排序值（越小越前面）
          <input className="form-input" type="number" min="0" step="1" value={state.sort_order}
            onChange={(event) => update("sort_order", event.target.value)} />
        </label>

        <label className="admin-product-checkbox">
          <input type="checkbox" checked={state.is_featured} onChange={(event) => update("is_featured", event.target.checked)} />
          設為精選商品（is_featured）
        </label>

        {message ? <p className={`admin-points-message ${message.kind}`} role="status">{message.text}</p> : null}

        <div className="admin-member-filter-actions">
          <button className="btn" type="submit" disabled={submitting}>
            {submitting ? "儲存中..." : mode === "create" ? "建立商品" : "儲存變更"}
          </button>
          {mode === "edit" && product && product.status !== "archived" ? (
            <button className="btn secondary" type="button" onClick={handleArchive} disabled={submitting}>下架商品（archive）</button>
          ) : null}
          <Link className="btn secondary" href="/admin/products">回到商品列表</Link>
        </div>
      </form>
    </section>
  );
}
