"use client";

// Track / cancel order logic for the storefront.
// Contract (both fields are now REQUIRED by the API):
//  - GET  /api/public/order/track?id=..&code=.. → { order: {...} } or generic 404
//  - POST /api/public/order/cancel { id, code } → { ok, id, date }

import { useCallback, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { PublicOrder } from "@/lib/types";
import type { TrackResult } from "../order-types";

export function useTrackOrder(onCancelled?: (id: string) => void) {
  const [trackInput, setTrackInput] = useState("");
  const [cancelCodeInput, setCancelCodeInput] = useState("");
  const [trackResult, setTrackResult] = useState<TrackResult | null>(null);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);

  // Programmatic tracking used by the "recent orders" chips: fill both
  // fields (so the customer sees what is being looked up) and track.
  const applyTrack = useCallback(
    async (id: string, code: string): Promise<void> => {
      setTrackInput(id);
      setCancelCodeInput(code.toUpperCase());
      setLoadingTrack(true);
      try {
        const res = await api<{ order: PublicOrder }>(
          `/api/public/order/track?id=${encodeURIComponent(
            id
          )}&code=${encodeURIComponent(code.toUpperCase())}`
        );
        setTrackResult({ kind: "order", order: res.order });
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          setTrackResult({ kind: "notfound", id });
        } else {
          const msg = e instanceof ApiError ? e.message : "Failed to track order.";
          toast(msg, "err");
          setTrackResult(null);
        }
      } finally {
        setLoadingTrack(false);
      }
    },
    []
  );

  async function handleTrack(idOverride?: number | string): Promise<void> {
    const id = idOverride ?? trackInput.trim();
    if (!id) {
      setTrackResult({ kind: "empty" });
      return;
    }
    const code = cancelCodeInput.trim().toUpperCase();
    if (!code) {
      toast(
        "Enter the 8-character cancellation code from your order confirmation.",
        "err"
      );
      setTrackResult(null);
      return;
    }
    setLoadingTrack(true);
    try {
      const res = await api<{ order: PublicOrder }>(
        `/api/public/order/track?id=${encodeURIComponent(
          String(id)
        )}&code=${encodeURIComponent(code)}`
      );
      setTrackResult({ kind: "order", order: res.order });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        // Generic 404: wrong number OR wrong code — never say which.
        setTrackResult({ kind: "notfound", id });
      } else {
        const msg = e instanceof ApiError ? e.message : "Failed to track order.";
        toast(msg, "err");
        setTrackResult(null);
      }
    } finally {
      setLoadingTrack(false);
    }
  }

  async function handleCancel(id: number | string): Promise<void> {
    const code = cancelCodeInput.trim().toUpperCase();
    if (!code) {
      toast(
        "Enter the cancellation code from your order confirmation, then press the button.",
        "err"
      );
      return;
    }
    setLoadingCancel(true);
    try {
      await api<{ ok: true; id: number; date: string }>(
        "/api/public/order/cancel",
        {
          method: "POST",
          body: { id, code },
        }
      );
      toast(`Order #${id} cancelled.`, "ok");
      onCancelled?.(String(id));
      await handleTrack(id);
    } catch (e) {
      const msg =
        e instanceof ApiError ? e.message : "Could not cancel this order.";
      toast(msg, "err");
    } finally {
      setLoadingCancel(false);
    }
  }

  return {
    trackInput,
    setTrackInput,
    cancelCodeInput,
    setCancelCodeInput,
    trackResult,
    loadingTrack,
    loadingCancel,
    handleTrack,
    handleCancel,
    applyTrack,
  };
}

export type TrackOrderController = ReturnType<typeof useTrackOrder>;
