import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireStaff } from "@/lib/api-helpers";
import { todayISO, type OrderLine } from "@/lib/types";

// ── Order editing (staff) ────────────────────────────────────────────────────
// Lets staff edit the customer/contact/steam/notes + item lines of an existing
// order. Recalculates total server-side. Logs the edit to stock_log.
//
// Restrictions:
//   - Cannot edit Done/Cancelled orders (they're closed).
//   - Item lines must reference existing inventory (resolved server-side for
//     name + price so the client can't forge them).

interface EditBody {
  id?: number | string;
  customer?: string;
  contact?: string;
  steam?: string;
  notes?: string;
  lines?: { itemId: number | string; qty: number }[];
}

export async function POST(req: Request) {
  const session = await requireStaff();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: EditBody;
  try {
    body = (await req.json()) as EditBody;
  } catch {
    return errorJson("Invalid request body.", 400);
  }

  const id = body.id == null ? "" : String(body.id).trim();
  if (!id) return errorJson("Order id required.", 400);

  const customer = (body.customer || "").trim();
  if (!customer) return errorJson("Customer name required.", 400);

  const sb = getSupabase();

  // Fetch the order to verify it's editable.
  const orderRes = await sb
    .from("orders")
    .select("id, status, lines")
    .eq("id", id)
    .maybeSingle();
  if (orderRes.error || !orderRes.data)
    return errorJson("Order not found.", 404);

  const currentStatus = String(orderRes.data.status || "Preparing");
  if (currentStatus === "Done" || currentStatus === "Cancelled") {
    return errorJson(
      `Cannot edit a ${currentStatus.toLowerCase()} order. Reopen it first or create a new one.`,
      400
    );
  }

  // Build the new lines array — resolve names/prices server-side.
  let newLines: OrderLine[] = [];
  let total = 0;
  if (Array.isArray(body.lines) && body.lines.length > 0) {
    const cleanItems = body.lines
      .map((i) => ({
        itemId: i.itemId as number | string,
        qty: Math.max(1, Number(i.qty) || 1),
      }))
      .filter((i) => i.itemId != null && String(i.itemId) !== "");
    if (cleanItems.length === 0)
      return errorJson("Add at least one item.", 400);

    const ids = Array.from(new Set(cleanItems.map((i) => i.itemId)));
    const invRes = await sb
      .from("inventory")
      .select("id, name, price")
      .in("id", ids);
    if (invRes.error || !invRes.data)
      return errorJson("Could not load inventory.", 500);
    const invMap = new Map(invRes.data.map((i) => [String(i.id), i]));
    for (const it of cleanItems) {
      const inv = invMap.get(String(it.itemId));
      if (!inv) continue;
      newLines.push({
        itemId: inv.id,
        name: inv.name,
        qty: it.qty,
        price: inv.price,
      });
      total += it.qty * inv.price;
    }
    if (newLines.length === 0)
      return errorJson("Selected items are unavailable.", 400);
  } else {
    // No lines provided — keep the existing lines.
    try {
      const parsed = JSON.parse(String(orderRes.data.lines || "[]"));
      if (Array.isArray(parsed)) newLines = parsed as OrderLine[];
      total = newLines.reduce((s, l) => s + l.qty * l.price, 0);
    } catch {
      newLines = [];
    }
  }

  const update = {
    customer,
    contact: (body.contact || "").trim(),
    steam: (body.steam || "").trim(),
    notes: (body.notes || "").trim(),
    lines: JSON.stringify(newLines),
  };

  const upd = await sb.from("orders").update(update).eq("id", id);
  if (upd.error) return errorJson("Could not update order.", 500);

  await sb.from("stock_log").insert({
    type: "order",
    text: `Order #${id} edited by <strong>${session.user}</strong> — ${total.toLocaleString()} R`,
    who: session.user,
    ts: new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    date: todayISO(),
  });

  return json({ ok: true, id, total });
}
