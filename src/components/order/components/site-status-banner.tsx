"use client";

// Closed / maintenance overlay banner shown in place of the order flow.
// Wording and colors preserved from the original storefront.

import type { SiteStatus } from "../order-types";

export function SiteStatusBanner({ status }: { status: SiteStatus }) {
  return (
    <div className="hd-closed-banner">
      <div
        className="hd-closed-title"
        style={{ color: status.maintenance ? "var(--accent)" : "var(--red)" }}
      >
        {status.maintenance
          ? "🔧 Site temporarily offline"
          : "🛑 Orders temporarily paused"}
      </div>
      <div className="hd-closed-sub">
        {status.maintenance
          ? "The order site is temporarily offline for maintenance. Please check back soon."
          : status.message}
      </div>
    </div>
  );
}
