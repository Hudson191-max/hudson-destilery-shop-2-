import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireOwner } from "@/lib/api-helpers";

// ── CSV helpers ──────────────────────────────────────────────────────────────
// RFC-4180-ish quoting plus a light spreadsheet-injection guard: values that
// could be interpreted as formulas (=, +, -, @, tab) get a leading apostrophe
// so opening the export in Excel/Sheets can't execute anything.
function csvEscape(value: unknown): string {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(headers: string[], rows: unknown[][]): string {
  const lines = [headers, ...rows].map((r) => r.map(csvEscape).join(","));
  // BOM so Excel opens UTF-8 names (ö, é, game handles…) correctly.
  return "\uFEFF" + lines.join("\r\n") + "\r\n";
}

function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

interface OrderLine {
  name?: string;
  qty?: number;
  price?: number;
}

function parseLines(raw: unknown): OrderLine[] {
  if (Array.isArray(raw)) return raw as OrderLine[];
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as OrderLine[]) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export async function GET(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  const url = new URL(req.url);
  const format = url.searchParams.get("format");
  const set = url.searchParams.get("set");

  // Classic full JSON backup (unchanged contract).
  if (format !== "csv") {
    const sb = getSupabase();
    const [invRes, ordRes, logRes] = await Promise.all([
      sb.from("inventory").select("*").order("id"),
      sb.from("orders").select("*").order("id"),
      sb
        .from("stock_log")
        .select("*")
        .order("id", { ascending: false })
        .limit(500),
    ]);

    return json({
      orders: ordRes.data || [],
      inventory: invRes.data || [],
      stockLog: logRes.data || [],
    });
  }

  const sb = getSupabase();
  const today = new Date().toISOString().slice(0, 10);

  if (set === "inventory") {
    const invRes = await sb.from("inventory").select("*").order("id");
    const rows = (invRes.data || []).map((i) => [
      i.id,
      i.name,
      i.cat,
      i.price,
      i.stock,
      i.active === false ? "hidden" : "active",
    ]);
    return csvResponse(
      `hudson-inventory-${today}.csv`,
      toCsv(
        ["id", "name", "category", "price", "stock", "status"],
        rows
      )
    );
  }

  // Default CSV set: orders.
  const ordRes = await sb.from("orders").select("*").order("id");
  const rows = (ordRes.data || []).map((o) => {
    const lines = parseLines(o.lines);
    const total = lines.reduce(
      (s, l) => s + (Number(l.qty) || 0) * (Number(l.price) || 0),
      0
    );
    const items = lines
      .map((l) => `${l.name ?? "?"} x${l.qty ?? 0}`)
      .join("; ");
    return [
      o.id,
      o.date ?? "",
      o.customer ?? "",
      o.contact ?? "",
      o.steam ?? "",
      items,
      total,
      o.status ?? "",
      o.created_by ?? "",
      // Notes can contain newlines — flatten them so each order stays one row
      // even before quoting (belt and braces on top of csvEscape).
      String(o.notes ?? "").replace(/\s*\n\s*/g, " "),
    ];
  });

  return csvResponse(
    `hudson-orders-${today}.csv`,
    toCsv(
      [
        "order",
        "date",
        "customer",
        "contact",
        "steam",
        "items",
        "total",
        "status",
        "created_by",
        "notes",
      ],
      rows
    )
  );
}
