"use client";

// Recent orders memory for the storefront. When a customer places an order we
// remember { id, code } pairs in localStorage so the track section can offer
// one-click tracking ("recent orders" chips) instead of typing both values.
// Cancelled orders are dropped automatically. Storage is capped at the 5 most
// recent orders and every read is sanitized — this is a convenience cache, not
// a source of truth.

import { useCallback, useEffect, useState } from "react";
import { toast } from "@/lib/toast";

const KEY = "hd_recent_orders_v1";
const MAX_RECENT = 5;

export interface RecentOrder {
  id: string;
  code: string;
  date: string;
  total: number;
}

function sanitize(raw: unknown): RecentOrder[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(
      (o): o is RecentOrder =>
        !!o &&
        typeof o === "object" &&
        typeof (o as RecentOrder).id === "string" &&
        /^\d{1,9}$/.test((o as RecentOrder).id) &&
        typeof (o as RecentOrder).code === "string" &&
        /^[A-Z0-9]{4,16}$/.test((o as RecentOrder).code)
    )
    .slice(0, MAX_RECENT)
    .map((o) => ({
      id: o.id,
      code: o.code,
      date: typeof o.date === "string" ? o.date.slice(0, 10) : "",
      total: Number.isFinite(o.total) ? o.total : 0,
    }));
}

function readStored(): RecentOrder[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    return sanitize(JSON.parse(raw));
  } catch {
    return [];
  }
}

function writeStored(list: RecentOrder[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
  } catch {
    // Private mode / quota exceeded — best-effort convenience feature.
  }
}

export function useRecentOrders() {
  const [recent, setRecent] = useState<RecentOrder[]>([]);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setRecent(readStored()); // eslint-disable-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, []);

  const remember = useCallback((order: RecentOrder) => {
    setRecent((prev) => {
      const next = [
        order,
        ...prev.filter((o) => o.id !== order.id),
      ].slice(0, MAX_RECENT);
      writeStored(next);
      return next;
    });
  }, []);

  const forget = useCallback((id: string | number) => {
    setRecent((prev) => {
      const next = prev.filter((o) => o.id !== String(id));
      writeStored(next);
      return next;
    });
  }, []);

  const clearAll = useCallback(() => {
    setRecent([]);
    writeStored([]);
  }, []);

  return { recent, hydrated, remember, forget, clearAll };
}

/** One-click track from a recent-order chip. Returns false if nothing changed. */
export async function quickTrack(
  entry: RecentOrder,
  apply: (id: string, code: string) => Promise<void>
): Promise<void> {
  if (!entry?.id || !entry?.code) return;
  toast(`Tracking order #${entry.id}…`, "ok");
  await apply(entry.id, entry.code);
}
