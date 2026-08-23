// Shared types & constants for The Hudson Distillery shop.

export type OrderStatus =
  | "Preparing"
  | "Pending"
  | "Waiting on Payment"
  | "Active"
  | "Ready for Delivery"
  | "Done"
  | "Cancelled";

export interface OrderLine {
  itemId: number | string;
  name: string;
  qty: number;
  price: number;
}

// Full order row as stored in Supabase (server only — never sent verbatim to public clients).
export interface OrderRow {
  id: number | string;
  customer: string;
  contact: string | null;
  steam: string | null;
  lines: string | OrderLine[] | null;
  notes: string | null;
  status: OrderStatus | string;
  date: string | null;
  created_by: string | null;
  cancel_code: string | null;
  closed_at: number | null;
}

export interface InventoryRow {
  id: number | string;
  name: string;
  price: number;
  stock: number;
  cat: string;
  // Whether the item is visible/purchasable on the public order page.
  // Older rows without the column will report undefined → treat as active.
  active?: boolean | null;
}

export interface StockLogRow {
  id: number | string;
  type: "add" | "remove" | "edit" | "order";
  text: string;
  who: string | null;
  ts: string | null;
  date: string | null;
}

export interface SettingsRow {
  key: string;
  value: string;
}

// Public-facing order (sensitive fields stripped: contact, steam, notes, cancel_code).
export interface PublicOrder {
  id: number | string;
  customer: string;
  status: string;
  date: string | null;
  lines: OrderLine[];
  total: number;
}

export const MAX_ORDER_TOTAL = 2_000_000;
export const MAX_ITEMS_PER_ORDER = 1000;

export const CURRENCY = "$";

export const LOGO_URL =
  "https://i.postimg.cc/0jB6HtW2/Chat-GPT-Image-25-mei-2026-11-35-47.png";

export const INVENTORY_CATEGORIES = [
  "Weapons",
  "Ammo",
  "Food & supplies",
  "Clothing",
  "Tools",
  "Vehicles",
  "Other",
];

export const DEFAULT_INVENTORY = [
  { name: "Moonshine", price: 500, stock: 0, cat: "Other" },
  { name: "Vodka", price: 250, stock: 16, cat: "Other" },
  { name: "Wine", price: 400, stock: 44, cat: "Other" },
  { name: "Berry Wine", price: 500, stock: 0, cat: "Other" },
  { name: "Rum", price: 250, stock: 17, cat: "Other" },
  { name: "Mead", price: 250, stock: 8, cat: "Other" },
  { name: "Ale", price: 250, stock: 68, cat: "Other" },
  { name: "Sake", price: 250, stock: 6, cat: "Other" },
  { name: "Beer", price: 250, stock: 10, cat: "Other" },
  { name: "Cider", price: 250, stock: 9, cat: "Other" },
];

export function parseLines(o: { lines?: string | OrderLine[] | null }): OrderLine[] {
  if (!o || !o.lines) return [];
  if (Array.isArray(o.lines)) return o.lines as OrderLine[];
  if (typeof o.lines === "string") {
    try {
      const parsed = JSON.parse(o.lines);
      return Array.isArray(parsed) ? (parsed as OrderLine[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function orderTotal(lines: OrderLine[] | null | undefined): number {
  return (lines || []).reduce((s, l) => s + l.qty * l.price, 0);
}

export function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function nowHM(): string {
  return new Date().toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
  });
}
