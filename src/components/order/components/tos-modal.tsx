"use client";

// Terms of Service collapsible block ("modal-style" disclosure).
// Bullets preserved verbatim from the original storefront.

import { useState } from "react";

export const TOS_BULLETS = [
  "Orders are accepted subject to stock availability and confirmation by The Hudson Distillery.",
  "Prices are final at the time of placement unless otherwise stated.",
  "You must provide accurate contact details so we can process and track your order.",
  "We may cancel or hold an order if details are unclear, incomplete, or if the order cannot be fulfilled.",
  "Customers may request cancellation before the order is prepared, subject to our current policy.",
  "The Hudson Distillery is not responsible for any data leaks, breaches, or unauthorized access to information submitted through this form. By placing an order you acknowledge that you are submitting your details at your own risk.",
  "We recommend not sharing sensitive personal information beyond what is required to complete your order.",
  "This service is not affiliated with, endorsed by, or connected to Unturned™ or URP.",
];

export function TosBlock(props: { open: boolean; onToggle: () => void }) {
  const { open, onToggle } = props;
  return (
    <div className="tos-wrap">
      <button
        type="button"
        className="tos-toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>Terms of Service</span>
        <span>
          {open ? "Hide" : "View"}
          <span className="tos-chevron">&#9660;</span>
        </span>
      </button>
      <div className={"tos-body" + (open ? " open" : "")}>
        <p>By placing an order, you agree to the following:</p>
        <ul>
          {TOS_BULLETS.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** Self-contained variant that owns its open state (used on the closed page). */
export function TosBlockStandalone() {
  const [open, setOpen] = useState(false);
  return <TosBlock open={open} onToggle={() => setOpen((v) => !v)} />;
}
