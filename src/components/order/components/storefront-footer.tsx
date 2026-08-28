"use client";

// Storefront footer: pinned to the bottom on short pages (mt-auto pattern —
// the root .hd-storefront is a min-h-screen flex column), pushed down on long
// ones. Includes the subtle staff entrance.

export function StorefrontFooter() {
  return (
    <footer className="hd-footer">
      <div className="hd-footer-line">
        The Hudson Distillery — not affiliated with Unturned™ or URP.
      </div>
      <nav className="hd-footer-nav" aria-label="Footer">
        <a href="/admin" className="hd-staff-link">
          Staff Login
        </a>
      </nav>
    </footer>
  );
}
