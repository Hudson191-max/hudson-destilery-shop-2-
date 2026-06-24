import { getSupabase } from "@/lib/supabase";
import { json, errorJson } from "@/lib/api-helpers";
import { todayISO } from "@/lib/types";

// Public cancellation. Verifies the cancel code server-side.
// Only selects cancel_code + status — never returns them to the client.
export async function POST(req: Request) {
  let body: { id?: number | string; code?: string };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const id = body.id == null ? "" : String(body.id).trim();
  const code = (body.code || "").trim().toUpperCase();
  if (!id) return errorJson("Please enter an order number.", 400);
  if (!code) return errorJson("Enter the cancellation code.", 400);

  const sb = getSupabase();
  const check = await sb
    .from("orders")
    .select("cancel_code, status")
    .eq("id", id)
    .maybeSingle();
  if (check.error || !check.data)
    return errorJson("Could not find that order.", 404);

  if (String(check.data.status || "").toLowerCase() === "cancelled")
    return errorJson("This order is already cancelled.", 400);

  const stored = String(check.data.cancel_code || "").toUpperCase();
  if (!stored || stored !== code)
    return errorJson("That cancellation code is incorrect.", 400);

  const upd = await sb
    .from("orders")
    .update({ status: "Cancelled", closed_at: Date.now() })
    .eq("id", id);
  if (upd.error) return errorJson("Could not cancel this order.", 500);

  return json({ ok: true, id, date: todayISO() });
}
