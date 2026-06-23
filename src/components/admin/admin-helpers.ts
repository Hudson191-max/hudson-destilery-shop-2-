// Shared helpers for the admin panel — pure functions, no React.
import {
  CURRENCY,
  LOGO_URL,
  type InventoryRow,
  type OrderRow,
  type OrderLine,
  type StockLogRow,
} from "@/lib/types";

// Order with pre-parsed lines + total — as returned by /api/admin/data.
export interface AdminOrder extends OrderRow {
  parsedLines: OrderLine[];
  total: number;
}

export interface AdminData {
  inventory: InventoryRow[];
  orders: AdminOrder[];
  stockLog: StockLogRow[];
  siteStatus: { closed: boolean; message: string };
  discordLink: string;
  role: "employee" | "owner" | "customer";
  user: string;
}

export { CURRENCY, LOGO_URL };

// Status → badge css class map.
const STATUS_BADGE_MAP: Record<string, string> = {
  Preparing: "preparing",
  "Waiting on Payment": "waiting",
  Pending: "pending",
  Active: "active",
  "Ready for Delivery": "ready-delivery",
  Done: "done",
  Cancelled: "cancelled",
};

export function statusBadgeClass(status: string): string {
  return "badge badge-" + (STATUS_BADGE_MAP[status] || "pending");
}

export type StockStatusKind = "out" | "low" | "ok";

export function stockStatusKind(stock: number): StockStatusKind {
  if (stock <= 0) return "out";
  if (stock <= 3) return "low";
  return "ok";
}

export function stockBarColor(stock: number): string {
  if (stock <= 0) return "var(--red)";
  if (stock <= 3) return "var(--yellow)";
  return "var(--green)";
}

export function stockBarPct(stock: number): number {
  return Math.min(100, Math.round((stock / 20) * 100));
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Build the white receipt markup (string) for print + html2canvas.
export function buildOrderReceiptMarkup(o: {
  id: number | string;
  customer: string;
  status: string;
  date: string | null;
  contact: string | null;
  parsedLines?: OrderLine[];
  lines?: string | OrderLine[] | null;
  total?: number;
}): string {
  const lines: OrderLine[] =
    (o as { parsedLines?: OrderLine[] }).parsedLines && (o as { parsedLines?: OrderLine[] }).parsedLines!.length
      ? (o as { parsedLines?: OrderLine[] }).parsedLines!
      : Array.isArray(o.lines)
        ? (o.lines as OrderLine[])
        : [];
  const total =
    typeof o.total === "number"
      ? o.total
      : lines.reduce((s, l) => s + l.qty * l.price, 0);

  const itemRows = lines
    .map(
      (l) =>
        `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #ddd;font-size:13px"><span>${escapeHtml(
          l.name
        )} ×${l.qty}</span><span>R${(l.qty * l.price).toLocaleString()}</span></div>`
    )
    .join("");

  return (
    `<div style="font-family:Arial, sans-serif;background:#fff;color:#000;padding:24px;max-width:720px;margin:0 auto">` +
    `<div style="display:flex;justify-content:space-between;align-items:center;gap:16px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #ddd">` +
    `<div><div style="font-size:24px;font-weight:700">THE HUDSON DISTILLERY</div><div style="font-size:13px;color:#444">Order receipt • ${escapeHtml(
      o.date || ""
    )}</div></div>` +
    `<img src="${LOGO_URL}" alt="The Hudson Distillery logo" style="height:54px;width:54px;object-fit:contain;border-radius:6px"/>` +
    `</div>` +
    `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #ddd;font-size:13px"><span>Order number</span><span>#${o.id}</span></div>` +
    `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #ddd;font-size:13px"><span>Customer</span><span>${escapeHtml(
      o.customer || "—"
    )}</span></div>` +
    `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #ddd;font-size:13px"><span>Status</span><span>${escapeHtml(
      o.status || "Preparing"
    )}</span></div>` +
    `<div style="display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #ddd;font-size:13px"><span>Contact</span><span>${escapeHtml(
      o.contact || "—"
    )}</span></div>` +
    itemRows +
    `<div style="font-size:16px;font-weight:700;padding-top:10px;margin-top:6px;border-top:2px solid #000;display:flex;justify-content:space-between;gap:12px"><span>Total</span><span>R${total.toLocaleString()}</span></div>` +
    `<div style="margin-top:16px;font-size:12px;color:#444;line-height:1.6">Thanks for ordering with us. Keep this receipt or share it in Discord if you need help with your order.</div>` +
    `</div>`
  );
}

export function buildOrderDiscordText(o: {
  id: number | string;
  customer: string;
  contact: string | null;
  steam: string | null;
  status: string;
  date: string | null;
  notes: string | null;
  parsedLines?: OrderLine[];
  lines?: string | OrderLine[] | null;
  total?: number;
}): string {
  const lines: OrderLine[] =
    (o as { parsedLines?: OrderLine[] }).parsedLines && (o as { parsedLines?: OrderLine[] }).parsedLines!.length
      ? (o as { parsedLines?: OrderLine[] }).parsedLines!
      : Array.isArray(o.lines)
        ? (o.lines as OrderLine[])
        : [];
  const total =
    typeof o.total === "number"
      ? o.total
      : lines.reduce((s, l) => s + l.qty * l.price, 0);
  return (
    `The Hudson Distillery\n` +
    `Order #${o.id}\n` +
    `Status: ${o.status || "Preparing"}\n` +
    `Customer: ${o.customer || "—"}\n` +
    `Contact: ${o.contact || "—"}\n` +
    `Items: ${lines.map((l) => l.name + " x" + l.qty).join(", ")}\n` +
    `Total: ${total.toLocaleString()} R`
  );
}

export function buildOrderSlipText(o: {
  id: number | string;
  customer: string;
  contact: string | null;
  steam: string | null;
  status: string;
  date: string | null;
  notes: string | null;
  parsedLines?: OrderLine[];
  lines?: string | OrderLine[] | null;
  total?: number;
}): string {
  const lines: OrderLine[] =
    (o as { parsedLines?: OrderLine[] }).parsedLines && (o as { parsedLines?: OrderLine[] }).parsedLines!.length
      ? (o as { parsedLines?: OrderLine[] }).parsedLines!
      : Array.isArray(o.lines)
        ? (o.lines as OrderLine[])
        : [];
  const total =
    typeof o.total === "number"
      ? o.total
      : lines.reduce((s, l) => s + l.qty * l.price, 0);
  return (
    `📦 **Order #${o.id} — The Hudson Distillery**\n` +
    `👤 Customer: ${o.customer}` +
    (o.contact ? `\n📞 Contact: ${o.contact}` : "") +
    (o.steam ? `\n🎮 Steam ID: ${o.steam}` : "") +
    `\n` +
    `📅 Date: ${o.date || ""}\n` +
    (o.notes ? `📝 Notes: ${o.notes}\n` : "") +
    `\n` +
    `**Items:**\n` +
    lines
      .map((l) => `• ${l.name} ×${l.qty} — ${(l.qty * l.price).toLocaleString()} R`)
      .join("\n") +
    `\n\n` +
    `💰 **Total: ${total.toLocaleString()} R**\n` +
    `🎮 **Steam ID: 76561199401090066**`
  );
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Split a textarea value into a clean string[] (comma or newline separated).
export function splitWhitelistInput(value: string): string[] {
  return (value || "")
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

// Confetti colors from the original.
export const CONFETTI_COLORS = [
  "#c8a84b",
  "#e8c96e",
  "#4caf7d",
  "#5b8dd9",
  "#e05c5c",
  "#f0f2f5",
];

// Site-status preset messages (verbatim from original).
export const SITE_STATUS_PRESETS: { label: string; message: string }[] = [
  { label: "Limit reached", message: "We’ve reached our order limit for now. Thanks for your support!" },
  { label: "Making improvements", message: "We’re making improvements. Back soon!" },
  { label: "Currently away", message: "We’re currently away. Orders will reopen soon!" },
  { label: "Not accepting orders", message: "We’re not accepting orders right now. Please check back again soon!" },
];
