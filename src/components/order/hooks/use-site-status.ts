"use client";

// Site status (open / closed / maintenance) for the storefront.
// Contract: GET /api/public/status → { closed, maintenance, message, discordLink }

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { SiteStatus } from "../order-types";

const FALLBACK_STATUS: SiteStatus = {
  closed: false,
  maintenance: false,
  message: "Orders are temporarily paused. Please check back soon.",
  discordLink: "",
};

export function useSiteStatus() {
  const [siteStatus, setSiteStatus] = useState<SiteStatus>(FALLBACK_STATUS);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const s = await api<SiteStatus>("/api/public/status");
        if (cancelled) return;
        setSiteStatus({
          closed: !!s.closed,
          maintenance: !!s.maintenance,
          message: s.message || FALLBACK_STATUS.message,
          discordLink: s.discordLink || "",
        });
      } catch {
        if (!cancelled) toast("Could not load site status.", "err");
      } finally {
        if (!cancelled) setLoadingStatus(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { siteStatus, loadingStatus };
}
