import { formatPriceTWD, PRODUCT_TYPE_LABELS, STOCK_STATUS_LABELS } from "@/lib/product-schema";
import type { PublicProduct } from "@/lib/products";

export function ProductCard({ product }: { product: PublicProduct }) {
  const hasCompareAt =
    product.compare_at_price_cents != null && product.compare_at_price_cents > product.price_cents;

  return (
    <article className="product-card">
      {product.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- product images are arbitrary remote URLs; next/image remote config is out of Stage 14 scope.
        <img className="product-card-media" src={product.image_url} alt={product.name} loading="lazy" />
      ) : (
        <div className="product-card-media product-card-media-empty" aria-hidden="true">🛍️</div>
      )}
      <div className="product-card-body">
        <div className="product-card-badges">
          <span className="product-badge type">{PRODUCT_TYPE_LABELS[product.product_type]}</span>
          {product.category ? <span className="product-badge category">{product.category}</span> : null}
          <span className="product-badge stock">{STOCK_STATUS_LABELS[product.stock_status]}</span>
        </div>
        <h3 className="product-card-title">{product.name}</h3>
        {product.subtitle ? <p className="product-card-subtitle">{product.subtitle}</p> : null}
        {product.description ? <p className="product-card-desc">{product.description}</p> : null}
        <div className="product-card-price">
          <strong>{formatPriceTWD(product.price_cents)}</strong>
          {hasCompareAt ? <s>{formatPriceTWD(product.compare_at_price_cents as number)}</s> : null}
        </div>
      </div>
    </article>
  );
}
