import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireOwner } from "@/lib/api-helpers";

export async function GET() {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  const sb = getSupabase();
  const [invRes, ordRes, logRes] = await Promise.all([
    sb.from("inventory").select("*").order("id"),
    sb.from("orders").select("*").order("id"),
    sb.from("stock_log").select("*").order("id", { ascending: false }).limit(500),
  ]);

  return json({
    orders: ordRes.data || [],
    inventory: invRes.data || [],
    stockLog: logRes.data || [],
  });
}
