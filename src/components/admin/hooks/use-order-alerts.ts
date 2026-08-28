"use client";
// New-order detection for the admin panel.
//
// The staff data poll (every 12s + on tab focus) returns the full orders list.
// This hook diffs it against the ids already seen and reports freshly arrived
// orders so the shell can toast + chime + badge them.
//
//  - The first load after login marks EVERYTHING as seen (no alert storm for
//    orders that arrived before the staff member opened the panel).
//  - Each order alerts exactly once per session (the seen-set lives in a ref).
//  - `newCount` counts orders that arrived but haven't been acknowledged by
//    visiting the dashboard; `ackAll()` clears it.
//  - When `enabled` flips false (logout / customer role) the state resets so a
//    later staff session starts clean.
//  - Diffs are committed in a deferred task so back-to-back polls coalesce and
//    an in-flight diff is cancelled if newer data arrives first.
import { useEffect, useRef, useState } from "react";
import type { OrderRow } from "@/lib/types";

export interface UseOrderAlerts {
  /** Orders that arrived and have not been acknowledged yet. */
  newCount: number;
  /** Acknowledge all pending alerts (e.g. after navigating to the dashboard). */
  ackAll: () => void;
}

export function useOrderAlerts(
  orders: OrderRow[],
  enabled: boolean,
  onNewOrder?: (order: OrderRow) => void
): UseOrderAlerts {
  const seenRef = useRef<Set<string> | null>(null);
  const onNewRef = useRef(onNewOrder);
  const [newIds, setNewIds] = useState<string[]>([]);

  // Always call the latest callback without retriggering the effect.
  useEffect(() => {
    onNewRef.current = onNewOrder;
  }, [onNewOrder]);

  useEffect(() => {
    const keyOf = (o: OrderRow) => String(o.id);

    if (!enabled) {
      // Session ended (logout/customer) — reset for the next staff session.
      const t = window.setTimeout(() => {
        seenRef.current = null;
        setNewIds([]);
      }, 0);
      return () => window.clearTimeout(t);
    }

    // First load: baseline everything as seen — no alert storm on login.
    // An EMPTY list means data hasn't loaded yet (not "no orders ever") —
    // baselining it would mark every real order as new once data arrives.
    if (seenRef.current === null) {
      if (!orders.length) return;
      seenRef.current = new Set(orders.map(keyOf));
      return;
    }

    const seen = seenRef.current;
    const arrived = orders.filter((o) => !seen.has(keyOf(o)));
    if (!arrived.length) return;
    // Alert oldest → newest so toasts read in chronological order.
    arrived.sort((a, b) => Number(a.id) - Number(b.id));

    const t = window.setTimeout(() => {
      for (const o of arrived) seen.add(keyOf(o));
      setNewIds((prev) => {
        const next = new Set(prev);
        for (const o of arrived) next.add(keyOf(o));
        return [...next];
      });
      for (const o of arrived) onNewRef.current?.(o);
    }, 0);
    return () => window.clearTimeout(t);
  }, [orders, enabled]);

  function ackAll() {
    setNewIds([]);
  }

  return { newCount: newIds.length, ackAll };
}
