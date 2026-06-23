import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireStaff } from "@/lib/api-helpers";
import { parseLines, todayISO, type InventoryRow, type OrderRow } from "@/lib/types";

export async function POST(req: Request) {
  const session = await requireStaff();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: { id?: number; status?: string };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const id = Number(body.id);
  const status = String(body.status || "");
  const allowed = [
    "Preparing",
    "Pending",
    "Waiting on Payment",
    "Active",
    "Ready for Delivery",
    "Done",
    "Cancelled",
  ];
  if (!Number.isFinite(id) || id <= 0) return errorJson("Invalid order id.", 400);
  if (!allowed.includes(status)) return errorJson("Invalid status.", 400);

  const sb = getSupabase();
  const orderRes = await sb
    .from("orders")
    .select("id, status, lines")
    .eq("id", id)
    .maybeSingle();
  if (orderRes.error || !orderRes.data)
    return errorJson("Order not found.", 404);
  const order = orderRes.data as Pick<OrderRow, "id" | "status" | "lines">;

  const update: { status: string; closed_at?: number } = { status };

  // When marking Done, deduct stock for each line.
  if (status === "Done") {
    const lines = parseLines({ lines: order.lines });
    const ids = Array.from(new Set(lines.map((l) => l.itemId)));
    if (ids.length) {
      const invRes = await sb
        .from("inventory")
        .select("id, stock")
        .in("id", ids);
      if (!invRes.error && invRes.data) {
        const invMap = new Map(
          (invRes.data as InventoryRow[]).map((i) => [i.id, i.stock])
        );
        for (const l of lines) {
          const current = invMap.get(l.itemId) ?? 0;
          const next = Math.max(0, current - l.qty);
          await sb.from("inventory").update({ stock: next }).eq("id", l.itemId);
        }
      }
    }
    update.closed_at = Date.now();
  }
  if (status === "Cancelled") update.closed_at = Date.now();

  const upd = await sb.from("orders").update(update).eq("id", id);
  if (upd.error) return errorJson("Could not update order.", 500);

  await sb.from("stock_log").insert({
    type: "order",
    text: `Order #${id} marked <strong>${status}</strong> by ${session.user}`,
    who: session.user,
    ts: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    date: todayISO(),
  });

  return json({ ok: true });
}
