"use client";
// Admin sidebar navigation. On small screens the existing hd-* media query
// (globals.css) flips it into a horizontal bar; here we make that bar clean:
// non-shrinking pills, hidden scrollbar with swipe + snap, 44px touch targets
// on mobile, and aria-current on the active tab.
//
// `badge` paints a pulsing count pill on one nav item (used by the new-order
// alert on Dashboard) with an sr-only description for screen readers.
import type { NavItem, Page } from "../types";
import { FOCUS_RING, TOUCH_TARGET } from "../components/touch";

export function AdminSidebar({
  items,
  page,
  onNavigate,
  showGroupLabel,
  badge,
}: {
  items: NavItem[];
  page: Page;
  onNavigate: (p: Page) => void;
  showGroupLabel: boolean;
  badge?: { page: Page; count: number };
}) {
  return (
    <aside
      className="hd-aside [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      role="navigation"
      aria-label="Admin sections"
    >
      {showGroupLabel ? <div className="nav-group-label">Navigation</div> : null}
      {items.map((n) => {
        const badgeCount = badge && badge.page === n.id ? badge.count : 0;
        return (
          <button
            key={n.id}
            className={`nav-btn shrink-0 ${TOUCH_TARGET} ${FOCUS_RING}` +
              (page === n.id ? " active" : "")}
            onClick={() => onNavigate(n.id)}
            aria-current={page === n.id ? "page" : undefined}
          >
            <span className="nav-icon">{n.icon}</span>
            {n.label}
            {badgeCount > 0 ? (
              <>
                <span className="nav-badge" aria-hidden="true">
                  {badgeCount > 9 ? "9+" : badgeCount}
                </span>
                <span className="sr-only">
                  {badgeCount} new {badgeCount === 1 ? "order" : "orders"}
                </span>
              </>
            ) : null}
          </button>
        );
      })}
    </aside>
  );
}
