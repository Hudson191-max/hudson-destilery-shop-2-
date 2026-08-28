"use client";

// Storefront hero header: logo + wordmark + tagline + open/closed status pill
// + theme toggle.

import { LOGO_URL } from "@/lib/types";
import { ThemeToggle } from "@/components/theme-toggle";
import type { SiteStatus } from "../order-types";

type Pill = { label: string; cls: string; hidden: boolean };

function statusPill(status: SiteStatus, loading: boolean): Pill {
  if (loading) return { label: "LOADING…", cls: "hd-pill-loading", hidden: true };
  if (status.maintenance) return { label: "MAINTENANCE", cls: "hd-pill-maint", hidden: true };
  if (status.closed) return { label: "CLOSED", cls: "hd-pill-closed", hidden: true };
  return { label: "OPEN", cls: "hd-pill-open", hidden: false };
}

export function StorefrontHeader({
  status,
  loading,
}: {
  status: SiteStatus;
  loading: boolean;
}) {
  const pill = statusPill(status, loading);
  return (
    <header className="hd-hero">
      <div className="hd-hero-inner">
        <img
          className="hd-hero-logo"
          src={LOGO_URL}
          alt="The Hudson Distillery logo"
          fetchPriority="high"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="hd-hero-text">
          <div className="hd-hero-title">
            THE HUDSON <span>DISTILLERY</span>
          </div>
          <div className="hd-hero-tag">
            HANDCRAFTED SPIRITS • FAST DELIVERY • FAIR PRICES
          </div>
        </div>
        <div className="hd-hero-actions">
          <span
            className={`hd-status-pill ${pill.cls}`}
            role="status"
            aria-live="polite"
            title={
              status.closed && !status.maintenance ? status.message : undefined
            }
          >
            <span className="hd-pill-dot" aria-hidden="true" />
            {pill.label}
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
