import type { Metadata } from "next";
import OrderView from "@/components/order/order-view";

// Storefront metadata lives here now that the order page has its own route.
export const metadata: Metadata = {
  title: "Order — The Hudson Distillery",
  description:
    "Place your order — Moonshine, Vodka, Rum, Mead, Ale & more. Track it any time with your cancellation code.",
  robots: { index: true, follow: true },
};

export default function StorefrontPage() {
  return <OrderView />;
}
