import { getSupabase } from "@/lib/supabase";
import { etagJson } from "@/lib/api-helpers";

// Public menu: only id, name, price for items that are available for sale.
// Stock is intentionally NOT exposed. Items toggled off (`active = false`)
// are hidden from the customer-facing order page.
export async function GET(req: Request) {
  const sb = getSupabase();
  const maintenanceRes = await sb
    .from("settings")
    .select("value")
    .eq("key", "maintenance_mode")
    .maybeSingle();
  if (
    maintenanceRes.data &&
    String(maintenanceRes.data.value).toLowerCase() === "true"
  ) {
    return etagJson(req, { items: [], maintenance: true }, "public, no-cache");
  }
  const res = await sb
    .from("inventory")
    .select("id, name, price, active")
    .order("id");
  if (res.error) return etagJson(req, { items: [] }, "public, no-cache");

  const items = (res.data || []).filter((row) => {
    // Treat null/undefined/missing `active` as active (backward-compat with
    // rows created before the column existed).
    const active = (row as { active?: boolean | null }).active;
    return active === null || active === undefined || active === true;
  });

  return etagJson(req, { items }, "public, no-cache");
}
