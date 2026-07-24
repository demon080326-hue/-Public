import type { PaymentSessionStatus } from "@/types/database";
import { getPaymentSessionStatusLabel } from "@/lib/payment-state";

export function PaymentStatusBadge({ status }: { status: PaymentSessionStatus }) {
  return (
    <span className={`order-status-badge payment-session-status-${status}`}>
      {getPaymentSessionStatusLabel(status)}
    </span>
  );
}
