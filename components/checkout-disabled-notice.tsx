export function CheckoutDisabledNotice() {
  return (
    <aside className="checkout-disabled-notice" role="status">
      <strong>付款功能尚未開放</strong>
      <p>本頁僅為 Checkout 前置測試頁，不會產生真實付款、不會扣款，也不會建立任何商品權益或點數。</p>
    </aside>
  );
}
