import { getSupabase, type Database } from "@/lib/supabase";
import { json, errorJson, requireOwner } from "@/lib/api-helpers";

type InventoryInsert = Database["public"]["Tables"]["inventory"]["Insert"];
type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];
type StockLogInsert = Database["public"]["Tables"]["stock_log"]["Insert"];

interface ImportPayload {
  inventory?: Array<Record<string, unknown>>;
  orders?: Array<Record<string, unknown>>;
  stockLog?: Array<Record<string, unknown>>;
}

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: ImportPayload;
  try {
    body = (await req.json()) as ImportPayload;
  } catch {
    return errorJson("Invalid import file — not valid JSON.", 400);
  }

  if (
    !Array.isArray(body.inventory) &&
    !Array.isArray(body.orders) &&
    !Array.isArray(body.stockLog)
  ) {
    return errorJson(
      "Import file has no inventory, orders, or stockLog arrays.",
      400
    );
  }

  const sb = getSupabase();
  const errors: string[] = [];
  let imported = { inventory: 0, orders: 0, stockLog: 0 };

  // ── Inventory ──────────────────────────────────────────────────────────
  if (Array.isArray(body.inventory) && body.inventory.length > 0) {
    // Wipe existing inventory so IDs don't conflict on upsert.
    const del = await sb.from("inventory").delete().neq("id", 0);
    if (del.error) {
      errors.push(`inventory wipe: ${del.error.message}`);
    } else {
      const rows: InventoryInsert[] = body.inventory.map((item) => ({
        id: typeof item.id === "number" ? item.id : undefined,
        name: String(item.name ?? ""),
        price: Number(item.price ?? 0),
        stock: Number(item.stock ?? 0),
        cat: String(item.cat ?? "Other"),
      }));
      const ins = await sb.from("inventory").insert(rows);
      if (ins.error) {
        errors.push(`inventory: ${ins.error.message}`);
      } else {
        imported.inventory = rows.length;
      }
    }
  }

  // ── Orders ─────────────────────────────────────────────────────────────
  if (Array.isArray(body.orders) && body.orders.length > 0) {
    const del = await sb.from("orders").delete().neq("id", 0);
    if (del.error) {
      errors.push(`orders wipe: ${del.error.message}`);
    } else {
      const rows: OrderInsert[] = body.orders.map((o) => {
        let lines = o.lines;
        if (lines && typeof lines !== "string") {
          lines = JSON.stringify(lines);
        }
        return {
          id: typeof o.id === "number" ? o.id : undefined,
          customer: String(o.customer ?? ""),
          contact: o.contact ? String(o.contact) : null,
          steam: o.steam ? String(o.steam) : null,
          lines: lines ? String(lines) : null,
          notes: o.notes ? String(o.notes) : null,
          status: String(o.status ?? "Preparing"),
          date: o.date ? String(o.date) : null,
          created_by: o.created_by ? String(o.created_by) : null,
          cancel_code: o.cancel_code ? String(o.cancel_code) : null,
          closed_at:
            typeof o.closed_at === "number" ? o.closed_at : null,
        };
      });
      const ins = await sb.from("orders").insert(rows);
      if (ins.error) {
        errors.push(`orders: ${ins.error.message}`);
      } else {
        imported.orders = rows.length;
      }
    }
  }

  // ── Stock log ──────────────────────────────────────────────────────────
  if (Array.isArray(body.stockLog) && body.stockLog.length > 0) {
    const del = await sb.from("stock_log").delete().neq("id", 0);
    if (del.error) {
      errors.push(`stock_log wipe: ${del.error.message}`);
    } else {
      const rows: StockLogInsert[] = body.stockLog.map((l) => ({
        type: String(l.type ?? ""),
        text: String(l.text ?? ""),
        who: l.who ? String(l.who) : null,
        ts: l.ts ? String(l.ts) : null,
        date: l.date ? String(l.date) : null,
      }));
      const ins = await sb.from("stock_log").insert(rows);
      if (ins.error) {
        errors.push(`stock_log: ${ins.error.message}`);
      } else {
        imported.stockLog = rows.length;
      }
    }
  }

  if (errors.length > 0) {
    return errorJson("Import partially failed.", 500, errors.join(" | "));
  }

  return json({ ok: true, imported });
}
