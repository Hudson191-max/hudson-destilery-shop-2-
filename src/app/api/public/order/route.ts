import { getSupabase } from "@/lib/supabase";
import { json, errorJson } from "@/lib/api-helpers";
import {
  MAX_ITEMS_PER_ORDER,
  MAX_ORDER_TOTAL,
  todayISO,
  type OrderLine,
} from "@/lib/types";
import { randomBytes } from "crypto";
import { notifyNewOrder } from "@/lib/discord-webhook";

export interface CreateOrderBody {
  customer: string;
  contact?: string;
  steam?: string;
  notes?: string;
  items: { itemId: number | string; qty: number }[];
  // Hidden honeypot: should stay empty. Helps filter naive bots.
  company?: string;
}

// Cryptographically secure cancel code: 8 chars from [A-Z0-9] (excludes
// ambiguous chars 0/O/1/I for readability). ~34^8 ≈ 1.8 trillion combinations.
function generateCancelCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = randomBytes(8);
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
}

export async function POST(req: Request) {
  let body: CreateOrderBody;
  try {
    body = (await req.json()) as CreateOrderBody;
  } catch {
    return errorJson("Invalid request body.", 400);
  }

  // Honeypot — silently accept but do nothing if filled.
  if (body.company && body.company.trim().length > 0) {
    return json({ ok: true });
  }

  const customer = (body.customer || "").trim();
  if (!customer) return errorJson("Enter your name.", 400);

  const items = Array.isArray(body.items) ? body.items : [];
  const cleanItems = items
    .map((i) => ({
      itemId: i.itemId as number | string,
      qty: Math.max(1, Number(i.qty) || 1),
    }))
    .filter((i) => i.itemId != null && String(i.itemId) !== "");

  if (!cleanItems.length) return errorJson("Select at least one item.", 400);

  const itemCount = cleanItems.reduce((s, i) => s + i.qty, 0);
  if (itemCount > MAX_ITEMS_PER_ORDER)
    return errorJson("That order exceeds the maximum allowed item count.", 400);

  // Verify the site is open before accepting.
  const sb = getSupabase();
  const closedRes = await sb
    .from("settings")
    .select("value")
    .eq("key", "site_closed")
    .maybeSingle();
  const closed =
    closedRes.data && String(closedRes.data.value).toLowerCase() === "true";
  if (closed) return errorJson("Orders are currently closed.", 400);

  // Resolve item names/prices server-side (never trust client prices).
  const ids = Array.from(new Set(cleanItems.map((i) => i.itemId)));
  const invRes = await sb
    .from("inventory")
    .select("id, name, price")
    .in("id", ids);
  if (invRes.error || !invRes.data)
    return errorJson("Could not load inventory.", 500);
  // Key by stringified id so numeric and UUID ids both resolve.
  const invMap = new Map(invRes.data.map((i) => [String(i.id), i]));
  const lines: OrderLine[] = [];
  let total = 0;
  for (const it of cleanItems) {
    const inv = invMap.get(String(it.itemId));
    if (!inv) continue;
    lines.push({ itemId: inv.id, name: inv.name, qty: it.qty, price: inv.price });
    total += it.qty * inv.price;
  }
  if (!lines.length) return errorJson("Selected items are unavailable.", 400);
  if (total > MAX_ORDER_TOTAL)
    return errorJson(
      `That order exceeds the maximum allowed total of ${MAX_ORDER_TOTAL.toLocaleString()} R.`,
      400
    );

  const cancelCode = generateCancelCode();
  const insertRes = await sb
    .from("orders")
    .insert({
      customer,
      contact: (body.contact || "").trim(),
      steam: (body.steam || "").trim(),
      lines: JSON.stringify(lines),
      notes: (body.notes || "").trim(),
      status: "Preparing",
      date: todayISO(),
      created_by: "customer",
      cancel_code: cancelCode,
    })
    .select("id, status")
    .single();

  if (insertRes.error || !insertRes.data)
    return errorJson("Failed to create order.", 500);

  // Fire-and-forget Discord webhook notification. Never blocks the response.
  void notifyNewOrder({
    orderId: insertRes.data.id,
    customer,
    contact: body.contact,
    steam: body.steam,
    notes: body.notes,
    lines,
    total,
    createdBy: "customer",
  });

  return json({
    id: insertRes.data.id,
    status: insertRes.data.status || "Preparing",
    cancelCode,
    lines,
    total,
    date: todayISO(),
    customer,
  });
}
