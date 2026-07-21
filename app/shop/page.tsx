import { LegacyPage } from "@/components/legacy-page";
import { ProductCard } from "@/components/product-card";
import { getPublishedProducts } from "@/lib/products";

export const dynamic = "force-dynamic";

export default async function ShopPage() {
  const products = await getPublishedProducts();

  return (
    <>
      <section className="section shop-products-section">
        <div className="wrap">
          <div className="section-head">
            <div>
              <span className="section-kicker">Shop · 商城商品</span>
              <h2>目前上架的商品</h2>
            </div>
            <p>以下是已發布的商品。本階段僅供瀏覽，購買、金流與下載解鎖尚未開放。</p>
          </div>

          {products.length > 0 ? (
            <div className="product-grid">
              {products.map((product) => <ProductCard key={product.id} product={product} />)}
            </div>
          ) : (
            <p className="cms-empty">商品即將上架，敬請期待。</p>
          )}
        </div>
      </section>

      <LegacyPage fileName="shop.html" />
    </>
  );
}
