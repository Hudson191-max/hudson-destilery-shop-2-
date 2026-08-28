import { getSupabase } from "@/lib/supabase";
import { etagJson } from "@/lib/api-helpers";

// Lightweight stock-availability feed for the storefront. Returns coarse
// stock LEVELS (never exact numbers) so customers get an informational
// "Out of stock" / "Low stock" hint on item cards:
//   out = stock <= 0, low = stock <= 5, ok otherwise.
// Ordering is NEVER blocked by this data — it is display-only.
// Items toggled inactive (`active = false`) are omitted: the storefront
// already hides them (see /api/public/inventory).
export async function GET(req: Request) {
  const sb = getSupabase();
  const res = await sb
    .from("inventory")
    .select("id, active, stock")
    .order("id");
  if (res.error) return etagJson(req, { levels: [] }, "public, no-cache");

  const levels = (res.data || [])
    .filter((row) => {
      const active = (row as { active?: boolean | null }).active;
      // Treat null/undefined/missing `active` as active (same rule as inventory).
      return active === null || active === undefined || active === true;
    })
    .map((row) => {
      const stock = Number((row as { stock?: number | null }).stock ?? 0);
      const level = stock <= 0 ? "out" : stock <= 5 ? "low" : "ok";
      return { id: row.id, level };
    });

  return etagJson(req, { levels }, "public, no-cache");
}
