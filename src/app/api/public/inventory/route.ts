import { getSupabase } from "@/lib/supabase";
import { json } from "@/lib/api-helpers";

// Public menu: only id, name, price. Stock is intentionally NOT exposed.
export async function GET() {
  const sb = getSupabase();
  const res = await sb.from("inventory").select("id, name, price").order("id");
  if (res.error) return json({ items: [] });
  return json({ items: res.data || [] });
}
