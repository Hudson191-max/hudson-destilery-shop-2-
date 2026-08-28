"use client";

// Public menu + coarse stock availability, fetched in parallel.
//  - GET /api/public/inventory  → { items: [{ id, name, price, active }] }
//  - GET /api/public/availability → { levels: [{ id, level: "out"|"low"|"ok" }] }
// Availability is informational only; a failure there silently means "no badges".

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { InventoryItem, StockLevels, StockLevel } from "../order-types";

export function useInventory() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [levels, setLevels] = useState<StockLevels>({});
  const [loadingInventory, setLoadingInventory] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [invRes, availRes] = await Promise.allSettled([
        api<{ items: InventoryItem[] }>("/api/public/inventory"),
        api<{ levels: { id: number | string; level: StockLevel }[] }>(
          "/api/public/availability"
        ),
      ]);
      if (cancelled) return;
      if (invRes.status === "fulfilled") {
        setItems(invRes.value.items || []);
      } else {
        toast("Could not load menu.", "err");
      }
      if (availRes.status === "fulfilled") {
        const map: StockLevels = {};
        for (const l of availRes.value.levels || []) {
          map[String(l.id)] = l.level;
        }
        setLevels(map);
      }
      // Availability failing is not user-visible — badges just stay hidden.
      setLoadingInventory(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { items, levels, loadingInventory };
}
