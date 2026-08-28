// Shared types, constants and pure helpers for the customer storefront.
// Split out of the old monolithic order-view.tsx (task 4-a). No React here.

import { CURRENCY, LOGO_URL, type OrderLine, type PublicOrder } from "@/lib/types";
import { toast } from "@/lib/toast";

/* ── Types ─────────────────────────────────────────────────────────── */

export type InventoryItem = { id: number | string; name: string; price: number };

export type StockLevel = "out" | "low" | "ok";
// itemId (stringified) → coarse stock level. Exact stock is never exposed.
export type StockLevels = Record<string, StockLevel>;

export interface SiteStatus {
  closed: boolean;
  maintenance: boolean;
  message: string;
  discordLink: string;
}

export interface SuccessData {
  id: number;
  cancelCode: string;
  status: string;
  customer: string;
  lines: OrderLine[];
  total: number;
  date: string;
}

export type TrackResult =
  | { kind: "order"; order: PublicOrder }
  | { kind: "notfound"; id: number | string }
  | { kind: "empty" };

export interface OrderFormValues {
  customer: string;
  contact: string;
  steam: string;
  notes: string;
  // Honeypot value — must stay empty; server no-ops when filled.
  company: string;
  agreed: boolean;
}

/* ── Constants ─────────────────────────────────────────────────────── */

export const CANCELLABLE_STATUSES = [
  "Preparing",
  "Pending",
  "Waiting on Payment",
  "Active",
];

export const TIMELINE_STEPS = [
  { title: "Order placed", sub: "Your order has been received and logged." },
  { title: "Preparing", sub: "We are gathering your items and getting it ready." },
  { title: "Ready for pickup", sub: "Your order is ready to be collected or delivered." },
  { title: "Completed", sub: "The order has been finished." },
];

export type DotState = "active" | "inactive" | "cancelled";

export const CART_STORAGE_KEY = "hd_cart_v1";

// Safety clamp for quantities restored from localStorage.
const MAX_QTY_PER_LINE = 10_000;

/* ── Status helpers ────────────────────────────────────────────────── */

export function statusBadgeClass(status: string): string {
  switch (status) {
    case "Preparing":
      return "badge-preparing";
    case "Waiting on Payment":
      return "badge-waiting";
    case "Pending":
      return "badge-pending";
    case "Active":
      return "badge-active";
    case "Ready for Delivery":
      return "badge-ready-delivery";
    case "Done":
      return "badge-done";
    case "Cancelled":
      return "badge-cancelled";
    default:
      return "badge-pending";
  }
}

export function isCancellable(status: string): boolean {
  return CANCELLABLE_STATUSES.includes(status || "Preparing");
}

export function statusHint(status: string): string {
  const s = status || "Preparing";
  if (s === "Cancelled") return "This order has been cancelled.";
  if (s === "Done") return "This order is complete.";
  return "We are working on your order. Keep your order number handy.";
}

export function computeTimeline(
  status: string
): { title: string; sub: string; state: DotState }[] {
  const s = status || "Preparing";
  if (s === "Cancelled") {
    return TIMELINE_STEPS.map((st) => ({ ...st, state: "cancelled" as DotState }));
  }
  const preparingActive = [
    "Preparing",
    "Pending",
    "Waiting on Payment",
    "Active",
    "Done",
  ].includes(s);
  const done = s === "Done";
  return TIMELINE_STEPS.map((st, i) => {
    let state: DotState = "inactive";
    if (i === 0) state = "active";
    else if (i === 1) state = preparingActive ? "active" : "inactive";
    else if (i === 2) state = done ? "active" : "inactive";
    else if (i === 3) state = done ? "active" : "inactive";
    return { ...st, state };
  });
}

/* ── Formatting ────────────────────────────────────────────────────── */

export function fmtPrice(n: number): string {
  return `${n.toLocaleString()} ${CURRENCY}`;
}

/* ── Cart persistence (localStorage "hd_cart_v1") ──────────────────── */

export function sanitizeCart(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!key || key.length > 24) continue;
    const q = Number(value);
    if (!Number.isFinite(q) || q < 1) continue;
    out[key] = Math.min(MAX_QTY_PER_LINE, Math.floor(q));
  }
  return Object.keys(out).length ? out : null;
}

export function cartItemCount(cart: Record<string, number>): number {
  return Object.values(cart).reduce((s, q) => s + (q || 0), 0);
}

export function cartTotal(
  cart: Record<string, number>,
  items: InventoryItem[]
): number {
  let t = 0;
  for (const key of Object.keys(cart)) {
    const item = items.find((i) => String(i.id) === key);
    if (item) t += item.price * cart[key];
  }
  return t;
}

export function cartLines(
  cart: Record<string, number>,
  items: InventoryItem[]
): OrderLine[] {
  return Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([k, q]) => {
      const item = items.find((i) => String(i.id) === k);
      return {
        itemId: k,
        name: item ? item.name : "—",
        qty: q,
        price: item ? item.price : 0,
      };
    });
}

/* ── Success actions: copy + print receipt ─────────────────────────── */

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function copyDetails(r: SuccessData): void {
  const text =
    `The Hudson Distillery\n` +
    `Order #${r.id}\n` +
    `Status: ${r.status}\n` +
    `Customer: ${r.customer}\n` +
    `Cancellation code: ${r.cancelCode}\n` +
    `Items: ${r.lines.map((l) => `${l.name} x${l.qty}`).join(", ")}\n` +
    `Total: ${r.total.toLocaleString()} ${CURRENCY}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast("Order details copied for Discord.", "ok"),
      () => toast("Copy failed. Please copy manually.", "err")
    );
  } else {
    toast("Clipboard is not available in this browser.", "err");
  }
}

export function printReceipt(r: SuccessData): void {
  const itemRows = r.lines
    .map(
      (l) =>
        `<div class="receipt-row"><span>${escapeHtml(l.name)} ×${l.qty}</span><span>${fmtPrice(
          l.qty * l.price
        )}</span></div>`
    )
    .join("");
  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
    `<title>Receipt #${r.id}</title>` +
    `<style>` +
    `body{margin:0;padding:24px;background:#fff;font-family:Arial,sans-serif}` +
    `.receipt-card{border:1px solid #000;padding:24px;max-width:720px;margin:0 auto;background:#fff;color:#000;font-family:Arial,sans-serif}` +
    `.receipt-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #ddd}` +
    `.receipt-logo{height:54px;width:54px;object-fit:contain;border-radius:6px}` +
    `.receipt-title{font-size:24px;font-weight:700;margin-bottom:2px}` +
    `.receipt-sub{font-size:13px;color:#444;margin-bottom:0}` +
    `.receipt-row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #ddd;font-size:13px}` +
    `.receipt-row:last-child{border-bottom:none}` +
    `.receipt-total{font-size:16px;font-weight:700;padding-top:10px;margin-top:6px;border-top:2px solid #000;display:flex;justify-content:space-between}` +
    `.receipt-note{margin-top:16px;font-size:12px;color:#444;line-height:1.6}` +
    `@media print{body{padding:0}}` +
    `</style></head><body>` +
    `<div class="receipt-card">` +
    `<div class="receipt-header">` +
    `<div><div class="receipt-title">THE HUDSON DISTILLERY</div>` +
    `<div class="receipt-sub">Order receipt • ${escapeHtml(r.date)}</div></div>` +
    `<img class="receipt-logo" src="${LOGO_URL}" alt="The Hudson Distillery logo"/></div>` +
    `<div class="receipt-row"><span>Order number</span><span>#${r.id}</span></div>` +
    `<div class="receipt-row"><span>Customer</span><span>${escapeHtml(r.customer)}</span></div>` +
    `<div class="receipt-row"><span>Status</span><span>${escapeHtml(r.status)}</span></div>` +
    `<div class="receipt-row"><span>Cancellation code</span><span>${escapeHtml(r.cancelCode)}</span></div>` +
    itemRows +
    `<div class="receipt-total"><span>Total</span><span>${fmtPrice(r.total)}</span></div>` +
    `<div class="receipt-note">Thanks for ordering with us. Keep this receipt or share it in Discord if you need help with your order.</div>` +
    `</div>` +
    `<script>window.onload=function(){window.print();}<\/script>` +
    `</body></html>`;
  const w = window.open("", "_blank", "width=760,height=900");
  if (!w) {
    toast("Pop-up blocked. Please allow pop-ups to print the receipt.", "err");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/* ── Category chips ────────────────────────────────────────────────── */
// The public inventory endpoint intentionally exposes no `cat` column, so the
// storefront derives coarse drink families from item names. Purely cosmetic
// filtering; unknown names fall through to "Other".

const CATEGORY_RULES: [RegExp, string][] = [
  [/moonshine|vodka|rum|whisk|gin|tequila|brandy|sake|spirit|liquor/i, "Spirits"],
  [/wine|mead/i, "Wine & Mead"],
  [/beer|ale|lager|cider|stout|ipa|brew/i, "Brews & Cider"],
];

export function deriveCategory(name: string): string {
  for (const [re, label] of CATEGORY_RULES) {
    if (re.test(name)) return label;
  }
  return "Other";
}

export function itemCategories(items: InventoryItem[]): string[] {
  const seen: string[] = [];
  for (const item of items) {
    const c = deriveCategory(item.name);
    if (!seen.includes(c)) seen.push(c);
  }
  return seen;
}
