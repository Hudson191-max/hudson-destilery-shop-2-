import { getSupabase, type Database } from "@/lib/supabase";
import { json, errorJson, requireOwner } from "@/lib/api-helpers";

type InventoryInsert = Database["public"]["Tables"]["inventory"]["Insert"];
type OrderInsert = Database["public"]["Tables"]["orders"]["Insert"];

interface ImportPayload {
  inventory?: Array<Record<string, unknown>>;
  orders?: Array<Record<string, unknown>>;
}

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: ImportPayload;
  try {
    body = (await req.json()) as ImportPayload;
  } catch {
    return errorJson("Invalid import file.", 400);
  }

  const sb = getSupabase();
  try {
    if (Array.isArray(body.inventory)) {
      for (const item of body.inventory) {
        await sb.from("inventory").upsert(item as InventoryInsert);
      }
    }
    if (Array.isArray(body.orders)) {
      for (const o of body.orders) {
        const payload = { ...o };
        if (payload.lines && typeof payload.lines !== "string") {
          payload.lines = JSON.stringify(payload.lines);
        }
        await sb.from("orders").upsert(payload as OrderInsert);
      }
    }
  } catch (e) {
    return errorJson(
      "Import failed.",
      500,
      e instanceof Error ? e.message : undefined
    );
  }

  return json({ ok: true });
}
