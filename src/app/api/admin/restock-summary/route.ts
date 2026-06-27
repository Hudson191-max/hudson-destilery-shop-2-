import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireOwner } from "@/lib/api-helpers";

// ── Restock summary (owner only) ────────────────────────────────────────────
// Aggregates every restock action in stock_log by employee, so the owner can
// see how much each staff member restocked over a date range — used for
// "payment per amount" payroll calculations.
//
// The qty isn't stored as its own column (for backward compat with old logs),
// so we parse it out of the `text` field. The text format is controlled by
// /api/admin/inventory/restock/route.ts and always looks like:
//
//   <strong>USERNAME</strong> restocked <strong>ITEM NAME</strong> +QTY — note
//
// The regex below extracts ITEM NAME and QTY. Rows that don't match (rare,
// e.g. manually-edited text) are counted in `unparseable` so the owner knows
// the total isn't 100% accurate.
//
// Query params:
//   ?from=YYYY-MM-DD  — inclusive lower bound (optional)
//   ?to=YYYY-MM-DD    — inclusive upper bound (optional)

interface ItemBreakdown {
  name: string;
  qty: number;
  count: number;
}

interface EmployeeSummary {
  who: string;
  totalQty: number;
  restockCount: number;
  items: ItemBreakdown[];
}

// Matches: ...restocked <strong>ITEM NAME</strong> +QTY...
// Item name can contain anything except the closing </strong> tag.
const RESTOCK_RE = /restocked\s+<strong>(.+?)<\/strong>\s+\+(\d+)/i;

function parseQtyFromText(text: string | null | undefined): {
  name: string;
  qty: number;
} | null {
  if (!text) return null;
  const m = text.match(RESTOCK_RE);
  if (!m) return null;
  const name = m[1].trim();
  const qty = parseInt(m[2], 10);
  if (!name || !Number.isFinite(qty) || qty <= 0) return null;
  return { name, qty };
}

export async function GET(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  const url = new URL(req.url);
  const from = url.searchParams.get("from") || null; // YYYY-MM-DD
  const to = url.searchParams.get("to") || null;

  // Basic validation: dates must look like YYYY-MM-DD if present.
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (from && !DATE_RE.test(from)) return errorJson("Invalid 'from' date.", 400);
  if (to && !DATE_RE.test(to)) return errorJson("Invalid 'to' date.", 400);

  const sb = getSupabase();
  let query = sb
    .from("stock_log")
    .select("id,type,text,who,ts,date")
    .eq("type", "add")
    .order("id", { ascending: false })
    .limit(10000);

  // Supabase date column is TEXT (YYYY-MM-DD), so string comparison works.
  if (from) query = query.gte("date", from);
  if (to) query = query.lte("date", to);

  const { data, error } = await query;
  if (error) return errorJson("Could not load stock log.", 500);

  const rows = (data || []) as {
    id: number | string;
    type: string;
    text: string | null;
    who: string | null;
    ts: string | null;
    date: string | null;
  }[];

  // Aggregate by employee.
  const byEmployee = new Map<string, EmployeeSummary>();
  let unparseable = 0;
  let totalQtyAll = 0;

  for (const row of rows) {
    const parsed = parseQtyFromText(row.text);
    if (!parsed) {
      unparseable++;
      continue;
    }
    const who = (row.who || "unknown").trim() || "unknown";
    let emp = byEmployee.get(who);
    if (!emp) {
      emp = { who, totalQty: 0, restockCount: 0, items: [] };
      byEmployee.set(who, emp);
    }
    emp.totalQty += parsed.qty;
    emp.restockCount += 1;
    totalQtyAll += parsed.qty;

    // Aggregate per-item within this employee.
    let item = emp.items.find((it) => it.name === parsed.name);
    if (!item) {
      item = { name: parsed.name, qty: 0, count: 0 };
      emp.items.push(item);
    }
    item.qty += parsed.qty;
    item.count += 1;
  }

  // Sort: employees by totalQty desc; items within employee by qty desc.
  const employees = Array.from(byEmployee.values())
    .map((emp) => ({
      ...emp,
      items: emp.items.sort((a, b) => b.qty - a.qty),
    }))
    .sort((a, b) => b.totalQty - a.totalQty);

  return json({
    ok: true,
    from,
    to,
    employees,
    totalQty: totalQtyAll,
    totalRestocks: employees.reduce((s, e) => s + e.restockCount, 0),
    unparseable,
    scannedRows: rows.length,
  });
}
