import { getSupabase } from "@/lib/supabase";
import { json, errorJson } from "@/lib/api-helpers";
import { parseLines, orderTotal, type PublicOrder } from "@/lib/types";

// Public order tracking. Returns ONLY: id, customer, status, date, lines (name/qty/price), total.
// Sensitive fields (contact, steam, notes, cancel_code) are NEVER selected.
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawId = searchParams.get("id");
  const id = rawId ? rawId.trim() : "";
  if (!id) return errorJson("Please enter an order number.", 400);

  const sb = getSupabase();
  const res = await sb
    .from("orders")
    .select("id, customer, status, date, lines")
    .eq("id", id)
    .maybeSingle();

  if (res.error || !res.data)
    return errorJson(`Order #${id} was not found.`, 404);

  const lines = parseLines({ lines: res.data.lines });
  const order: PublicOrder = {
    id: res.data.id,
    customer: res.data.customer || "—",
    status: String(res.data.status || "Preparing"),
    date: res.data.date || null,
    lines,
    total: orderTotal(lines),
  };
  return json({ order });
}
