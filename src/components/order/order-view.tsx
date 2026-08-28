"use client";

// Storefront composing parent (task 4-a). The old 1171-line monolith is split
// into focused hooks + components under src/components/order/**. Behavior is
// preserved: same API contracts, same validation/toast order, track & Discord
// sections visible in every state, honeypot intact.
//
// New in 4-a: hero header with status pill + theme toggle, menu search &
// category chips, stock badges (informational only), localStorage cart
// persistence ("hd_cart_v1"), sticky desktop cart / mobile bottom sheet,
// skeleton loaders, framer-motion micro-animations, sticky footer with a
// staff link.

import { useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  CURRENCY,
  MAX_ITEMS_PER_ORDER,
  MAX_ORDER_TOTAL,
  type OrderLine,
} from "@/lib/types";
import { useSiteStatus } from "./hooks/use-site-status";
import { useInventory } from "./hooks/use-inventory";
import { useOrderCart } from "./hooks/use-order-cart";
import { useTrackOrder } from "./hooks/use-track-order";
import { useRecentOrders } from "./hooks/use-recent-orders";
import type { OrderFormValues, SuccessData } from "./order-types";
import { StorefrontHeader } from "./components/storefront-header";
import { SiteStatusBanner } from "./components/site-status-banner";
import { MenuSection } from "./components/menu-section";
import { CartPanel, MobileCartBar } from "./components/cart-panel";
import { OrderForm } from "./components/order-form";
import { OrderSuccess } from "./components/order-success";
import { TrackOrder } from "./components/track-order";
import { TosBlock } from "./components/tos-modal";
import { DiscordLink } from "./components/discord-link";
import { StorefrontFooter } from "./components/storefront-footer";

export default function OrderView() {
  const { siteStatus, loadingStatus } = useSiteStatus();
  const { items, levels, loadingInventory } = useInventory();
  const cart = useOrderCart(items);
  const recent = useRecentOrders();
  // Drop a recent-order chip automatically once that order is cancelled.
  const track = useTrackOrder((id) => recent.forget(id));

  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [closedTosOpen, setClosedTosOpen] = useState(false);
  // Bumped to remount <OrderForm> so customer fields reset after an order
  // (same effect as the original resetForm, without lifting field state).
  const [formEpoch, setFormEpoch] = useState(0);

  const closed = siteStatus.closed || siteStatus.maintenance;
  // The shop flow (menu/cart/form) — the track section is visible in every state.
  const shopOpen = !loadingStatus && !closed && !success;

  async function handleSubmit(v: OrderFormValues): Promise<void> {
    if (siteStatus.maintenance) {
      toast("The order site is temporarily offline for maintenance.", "err");
      return;
    }
    if (siteStatus.closed) {
      toast("Orders are currently closed. Please try again later.", "err");
      return;
    }
    const name = v.customer.trim();
    if (!name) {
      toast("Enter your name", "err");
      return;
    }
    if (!v.contact.trim()) {
      toast("Enter your contact information", "err");
      return;
    }
    if (!v.steam.trim()) {
      toast("Enter your Steam ID 64", "err");
      return;
    }
    const entries = Object.entries(cart.cart).filter(([, q]) => q > 0);
    if (!entries.length) {
      toast("Select at least one item", "err");
      return;
    }
    if (!v.agreed) {
      toast("Please agree to the Terms of Service.", "err");
      return;
    }
    const total = cart.total;
    const itemCount = cart.itemCount;
    if (total > MAX_ORDER_TOTAL) {
      toast(
        `That order exceeds the maximum allowed total of ${MAX_ORDER_TOTAL.toLocaleString()} ${CURRENCY}.`,
        "err"
      );
      return;
    }
    if (itemCount > MAX_ITEMS_PER_ORDER) {
      toast("That order exceeds the maximum allowed item count.", "err");
      return;
    }
    const itemsPayload = entries.map(([k, q]) => ({
      itemId: k,
      qty: q,
    }));
    setSubmitting(true);
    try {
      const res = await api<{
        id: number;
        status: string;
        cancelCode: string;
        lines: OrderLine[];
        total: number;
        date: string;
        customer: string;
      }>("/api/public/order", {
        method: "POST",
        body: {
          customer: name,
          contact: v.contact.trim(),
          steam: v.steam.trim(),
          notes: v.notes.trim(),
          items: itemsPayload,
          company: v.company,
        },
      });
      if (!res || !res.id) {
        toast("Failed to place order.", "err");
        return;
      }
      setSuccess({
        id: res.id,
        cancelCode: res.cancelCode,
        status: res.status || "Preparing",
        customer: res.customer,
        lines: res.lines || [],
        total: res.total,
        date: res.date,
      });
      toast(`Order #${res.id} placed.`, "ok");
      // Remember id+code on this device so the track section can offer
      // one-click tracking for it later.
      recent.remember({
        id: String(res.id),
        code: res.cancelCode,
        date: res.date,
        total: res.total,
      });
      // Cart is emptied (and its localStorage entry cleared) once the order is
      // in — a persisted cart here would invite accidental double orders.
      cart.clearCart();
      setFormEpoch((e) => e + 1);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to place order.";
      toast(msg, "err");
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm(): void {
    cart.clearCart();
    setSuccess(null);
    setFormEpoch((e) => e + 1);
  }

  const cartPanelProps = {
    lines: cart.summaryLines,
    total: cart.total,
    itemCount: cart.itemCount,
    onToggleLine: cart.toggleItem,
    onAddLine: cart.addOne,
    onSubLine: cart.subOne,
    onSetLineQty: cart.setQty,
    onClear: cart.clearCart,
  };

  return (
    <div
      className={
        "hd-order-bg hd-storefront" + (cart.itemCount > 0 ? " hd-with-cartbar" : "")
      }
    >
      <StorefrontHeader status={siteStatus} loading={loadingStatus} />

      <main className="container hd-store-main">
        {loadingStatus ? (
          <div className="hd-boot-loading">LOADING…</div>
        ) : closed ? (
          <>
            <SiteStatusBanner status={siteStatus} />
            <div style={{ marginTop: 8, marginBottom: 24 }}>
              <TosBlock
                open={closedTosOpen}
                onToggle={() => setClosedTosOpen((v) => !v)}
              />
            </div>
          </>
        ) : success ? (
          <OrderSuccess data={success} onReset={resetForm} />
        ) : (
          <div className="hd-store-layout">
            <div className="hd-store-content">
              <MenuSection
                items={items}
                levels={levels}
                loading={loadingInventory}
                cart={cart.cart}
                onToggle={cart.toggleItem}
                onAddOne={cart.addOne}
                onSubOne={cart.subOne}
                onSetQty={cart.setQty}
              />
            </div>
            <aside className="hd-cart-rail" aria-label="Order summary">
              <CartPanel {...cartPanelProps} />
            </aside>
          </div>
        )}

        {shopOpen && (
          <>
            <OrderForm key={formEpoch} submitting={submitting} onSubmit={handleSubmit} />
          </>
        )}

        {/* Track / cancel — always visible below the order stage. */}
        <TrackOrder
          {...track}
          recentOrders={recent.recent}
          onQuickTrack={(entry) => void track.applyTrack(entry.id, entry.code)}
          onForgetOrder={recent.forget}
        />

        <DiscordLink href={siteStatus.discordLink} />
      </main>

      <StorefrontFooter />

      {/* Mobile-only sticky cart bar + bottom sheet (hidden on desktop via CSS). */}
      {shopOpen && <MobileCartBar {...cartPanelProps} />}
    </div>
  );
}
