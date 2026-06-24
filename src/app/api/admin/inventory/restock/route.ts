import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireStaff } from "@/lib/api-helpers";
import { todayISO } from "@/lib/types";

// Restock (employee + owner)
export async function POST(req: Request) {
  const session = await requireStaff();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: { id?: number; qty?: number; note?: string };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const id = Number(body.id);
  const qty = Number(body.qty) || 0;
  if (!Number.isFinite(id) || id <= 0) return errorJson("Invalid item.", 400);
  if (qty <= 0) return errorJson("Enter a valid quantity.", 400);

  const sb = getSupabase();
  const cur = await sb
    .from("inventory")
    .select("id, name, stock")
    .eq("id", id)
    .maybeSingle();
  if (cur.error || !cur.data) return errorJson("Item not found.", 404);
  const item = cur.data as { id: number; name: string; stock: number };

  const upd = await sb
    .from("inventory")
    .update({ stock: item.stock + qty })
    .eq("id", id);
  if (upd.error) return errorJson("Could not restock.", 500);

  const note = (body.note || "").trim();
  await sb.from("stock_log").insert({
    type: "add",
    text: `<strong>${session.user}</strong> restocked <strong>${item.name}</strong> +${qty}${
      note ? ` — ${note}` : ""
    }`,
    who: session.user,
    ts: new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
    date: todayISO(),
  });

  return json({ ok: true });
}
