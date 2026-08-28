"use client";

// Cart state for the storefront with localStorage persistence ("hd_cart_v1").
//  - Starts empty on the server AND on the client's first render (SSR-safe),
//    then hydrates from localStorage in a mount effect (no hydration mismatch).
//  - Every change is written back to localStorage once hydrated, so the cart
//    survives refreshes and navigation.
//  - Sanitization guards against corrupted/oversized stored data.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { OrderLine } from "@/lib/types";
import {
  CART_STORAGE_KEY,
  cartItemCount,
  cartLines,
  cartTotal,
  sanitizeCart,
  type InventoryItem,
} from "../order-types";

export interface UseOrderCartResult {
  cart: Record<string, number>;
  /** True once the localStorage hydration pass has run (client only). */
  hydrated: boolean;
  /** Card click behaviour: adds the item with qty 1, or removes it. */
  toggleItem: (id: number | string) => void;
  /** "+" button: increments, or adds the item with qty 1 if absent. */
  addOne: (id: number | string) => void;
  /** "−" button: decrements; at qty 1 removes the item. No-op if absent. */
  subOne: (id: number | string) => void;
  /** Direct qty entry: clamped to ≥ 1. No-op for items not in the cart. */
  setQty: (id: number | string, val: number) => void;
  clearCart: () => void;
  summaryLines: OrderLine[];
  total: number;
  itemCount: number;
}

function readStoredCart(): Record<string, number> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return null;
    return sanitizeCart(JSON.parse(raw));
  } catch {
    return null;
  }
}

function writeStoredCart(cart: Record<string, number>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
  } catch {
    // Private mode / quota exceeded — persistence is best-effort.
  }
}

export function useOrderCart(items: InventoryItem[]): UseOrderCartResult {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [hydrated, setHydrated] = useState(false);
  const hydratedRef = useRef(false);

  // Hydrate once on mount (client only — never runs during SSR).
  // Reading localStorage and mirroring it into state REQUIRES an effect with
  // setState: the SSR HTML must render the empty cart, and only after mount
  // may we adopt the persisted one (avoids hydration mismatches). The lint
  // rule is disabled deliberately for this hydration pattern.
  useEffect(() => {
    const stored = readStoredCart();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setCart(stored);
    hydratedRef.current = true;
    setHydrated(true);
  }, []);

  // Persist after every change, but never before hydration
  // (would overwrite the stored cart with the pre-hydration {}).
  useEffect(() => {
    if (!hydratedRef.current) return;
    writeStoredCart(cart);
  }, [cart]);

  const toggleItem = useCallback((id: number | string) => {
    const key = String(id);
    setCart((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = 1;
      return next;
    });
  }, []);

  const addOne = useCallback((id: number | string) => {
    const key = String(id);
    setCart((prev) => {
      const next = { ...prev };
      next[key] = (next[key] || 0) + 1;
      return next;
    });
  }, []);

  const subOne = useCallback((id: number | string) => {
    const key = String(id);
    setCart((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      if (next[key] <= 1) delete next[key];
      else next[key] = next[key] - 1;
      return next;
    });
  }, []);

  const setQty = useCallback((id: number | string, val: number) => {
    const key = String(id);
    setCart((prev) => {
      if (!prev[key]) return prev; // untouched items stay out of the cart
      const next = { ...prev };
      next[key] = Math.max(1, Number.isNaN(val) ? 1 : val);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => setCart({}), []);

  const summaryLines = useMemo(() => cartLines(cart, items), [cart, items]);
  const total = useMemo(() => cartTotal(cart, items), [cart, items]);
  const itemCount = useMemo(() => cartItemCount(cart), [cart]);

  return {
    cart,
    hydrated,
    toggleItem,
    addOne,
    subOne,
    setQty,
    clearCart,
    summaryLines,
    total,
    itemCount,
  };
}
