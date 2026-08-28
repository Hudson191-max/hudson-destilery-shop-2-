"use client";

// Cart summary: desktop sticky panel + mobile bottom bar & sheet.
// Framer-motion micro-animations pop the item counter and slide lines in/out.

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { OrderLine } from "@/lib/types";
import { fmtPrice } from "../order-types";

const spring = { type: "spring" as const, stiffness: 500, damping: 28 };

export interface CartPanelProps {
  lines: OrderLine[];
  total: number;
  itemCount: number;
  onToggleLine: (id: number | string) => void;
  onAddLine: (id: number | string) => void;
  onSubLine: (id: number | string) => void;
  onSetLineQty: (id: number | string, val: number) => void;
  onClear: () => void;
}

export function CartPanel(props: CartPanelProps) {
  const { lines, total, itemCount, onToggleLine, onAddLine, onSubLine, onSetLineQty, onClear } =
    props;
  return (
    <div className="summary-card hd-cart-panel">
      <div className="card-title">
        Your order
        {itemCount > 0 && (
          <motion.span
            key={itemCount}
            className="hd-cart-count"
            initial={{ scale: 1.45, opacity: 0.35 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={spring}
            aria-label={`${itemCount} item${itemCount === 1 ? "" : "s"} in cart`}
          >
            {itemCount}
          </motion.span>
        )}
        {itemCount > 0 && (
          <button
            type="button"
            className="hd-cart-clear"
            onClick={onClear}
            aria-label="Clear cart"
            title="Clear cart"
          >
            Clear
          </button>
        )}
      </div>

      {lines.length === 0 ? (
        <div className="hd-cart-empty">
          <div className="hd-cart-empty-icon" aria-hidden="true">
            🛒
          </div>
          <div className="empty-cart">NO ITEMS SELECTED YET</div>
          <div className="hd-cart-empty-sub">Tap a drink to add it to your order.</div>
        </div>
      ) : (
        <>
          <AnimatePresence initial={false}>
            {lines.map((l) => (
              <motion.div
                className="summary-line hd-cart-line"
                key={l.itemId}
                layout
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.16 }}
              >
                <span className="hd-cart-line-name">
                  {l.name} <span className="hd-cart-line-x">×{l.qty}</span>
                  <span className="hd-cart-line-ctl">
                    <button
                      type="button"
                      className="qty-btn qty-btn-sm"
                      onClick={() => onSubLine(l.itemId)}
                      aria-label={`Decrease ${l.name} quantity`}
                    >
                      −
                    </button>
                    <button
                      type="button"
                      className="qty-btn qty-btn-sm"
                      onClick={() => onAddLine(l.itemId)}
                      aria-label={`Increase ${l.name} quantity`}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="hd-cart-line-remove"
                      onClick={() => onToggleLine(l.itemId)}
                      aria-label={`Remove ${l.name} from cart`}
                      title="Remove"
                    >
                      ✕
                    </button>
                  </span>
                </span>
                <span className="hd-cart-line-price">{fmtPrice(l.qty * l.price)}</span>
              </motion.div>
            ))}
          </AnimatePresence>
          <div className="summary-total">
            <span>Total</span>
            <span>{fmtPrice(total)}</span>
          </div>
        </>
      )}
    </div>
  );
}

/** Mobile-only sticky bottom bar + expandable sheet (hidden on desktop via CSS). */
export function MobileCartBar(props: CartPanelProps) {
  const { itemCount, total, ...panel } = props;
  const [open, setOpen] = useState(false);
  if (itemCount === 0) return null;

  function continueToDetails() {
    setOpen(false);
    // Let the exit animation start, then bring the checkout form into view.
    window.setTimeout(() => {
      document
        .getElementById("order-details")
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);
  }

  return (
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            key="backdrop"
            className="hd-cartbar-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      <motion.div
        className="hd-cartbar"
        initial={{ y: 90 }}
        animate={{ y: 0 }}
        exit={{ y: 90 }}
        transition={spring}
      >
        <button
          type="button"
          className="hd-cartbar-main"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          aria-controls="hd-cart-sheet"
        >
          <span className="hd-cartbar-icon" aria-hidden="true">
            🧺
            <motion.span
              key={itemCount}
              className="hd-cartbar-count"
              initial={{ scale: 1.5 }}
              animate={{ scale: 1 }}
              transition={spring}
            >
              {itemCount}
            </motion.span>
          </span>
          <span className="hd-cartbar-total">{fmtPrice(total)}</span>
          <span className="hd-cartbar-hint">{open ? "Hide ▾" : "Review order ▴"}</span>
        </button>
      </motion.div>

      <AnimatePresence>
        {open && (
          <motion.div
            id="hd-cart-sheet"
            className="hd-cart-sheet"
            role="dialog"
            aria-label="Your order"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", stiffness: 380, damping: 36 }}
          >
            <CartPanel {...panel} itemCount={itemCount} total={total} />
            <button
              type="button"
              className="submit-btn"
              onClick={continueToDetails}
            >
              Continue to details ↓
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
