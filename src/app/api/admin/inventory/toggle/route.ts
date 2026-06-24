import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireOwner } from "@/lib/api-helpers";
import { todayISO } from "@/lib/types";

// Toggle the `active` flag on an inventory item (owner only).
// When `active = false`, the item is hidden from the public order page and
// cannot be ordered — even if a stale client page still shows it.
export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: { id?: number; active?: boolean };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }

  const id = Number(body.id);
  if (!Number.isFinite(id) || id <= 0) return errorJson("Invalid id.", 400);

  // Coerce to a strict boolean — never trust the client's raw value.
  const active = body.active === true;

  const sb = getSupabase();
  const cur = await sb
    .from("inventory")
    .select("id, name, active")
    .eq("id", id)
    .maybeSingle();
  if (cur.error) {
    // Postgres error code 42703 = undefined_column. The most common cause is
    // the `active` column not being added to the inventory table yet. Surface
    // a helpful message rather than a misleading "item not found".
    const code = (cur.error as { code?: string }).code;
    if (code === "42703" || /active/.test(cur.error.message || "")) {
      return errorJson(
        "The inventory table is missing the 'active' column. Run this SQL in Supabase: ALTER TABLE inventory ADD COLUMN active BOOLEAN NOT NULL DEFAULT TRUE;",
        500,
        cur.error.message
      );
    }
    return errorJson("Could not load item.", 500, cur.error.message);
  }
  if (!cur.data) return errorJson("Item not found.", 404);

  const upd = await sb
    .from("inventory")
    .update({ active })
    .eq("id", id);
  if (upd.error) return errorJson("Could not update item.", 500);

  const name = cur.data.name || `#${id}`;
  await sb.from("stock_log").insert({
    type: "edit",
    text: `<strong>${session.user}</strong> ${
      active ? "enabled" : "disabled"
    } <strong>${name}</strong> for sale`,
    who: session.user,
    ts: new Date().toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
    }),
    date: todayISO(),
  });

  return json({ ok: true, id, active });
}
