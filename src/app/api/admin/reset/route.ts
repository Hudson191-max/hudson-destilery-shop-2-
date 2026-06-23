import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireOwner } from "@/lib/api-helpers";
import { DEFAULT_INVENTORY } from "@/lib/types";

export async function POST() {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  const sb = getSupabase();
  await Promise.all([
    sb.from("orders").delete().neq("id", 0),
    sb.from("inventory").delete().neq("id", 0),
    sb.from("stock_log").delete().neq("id", 0),
  ]);
  await sb.from("inventory").insert(DEFAULT_INVENTORY);

  return json({ ok: true });
}
