import { getSupabase } from "@/lib/supabase";
import { json } from "@/lib/api-helpers";

// Public menu: only id, name, price for items that are available for sale.
// Stock is intentionally NOT exposed. Items toggled off (`active = false`)
// are hidden from the customer-facing order page.
export async function GET() {
  const sb = getSupabase();
  const res = await sb
    .from("inventory")
    .select("id, name, price, active")
    .order("id");
  if (res.error) return json({ items: [] });

  const items = (res.data || []).filter((row) => {
    // Treat null/undefined/missing `active` as active (backward-compat with
    // rows created before the column existed).
    const active = (row as { active?: boolean | null }).active;
    return active === null || active === undefined || active === true;
  });

  return json({ items });
}
