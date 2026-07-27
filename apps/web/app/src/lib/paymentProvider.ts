export type PaymentProvider = "stripe" | "paypal" | "venmo" | "zelle" | "other";

export function detectPaymentProvider(url: string): PaymentProvider {
  const u = url.trim().toLowerCase();
  if (!u) return "other";
  if (u.includes("stripe.com") || u.includes("buy.stripe")) return "stripe";
  if (u.includes("paypal.com") || u.includes("paypal.me")) return "paypal";
  if (u.includes("venmo.com")) return "venmo";
  if (u.includes("zelle") || u.includes("enroll.zellepay")) return "zelle";
  return "other";
}

export function paymentProviderLabel(p: PaymentProvider): string {
  switch (p) {
    case "stripe":
      return "Stripe";
    case "paypal":
      return "PayPal";
    case "venmo":
      return "Venmo";
    case "zelle":
      return "Zelle";
    default:
      return "Payment link";
  }
}
