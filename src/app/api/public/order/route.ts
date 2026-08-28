import { getSupabase } from "@/lib/supabase";
import { json, errorJson } from "@/lib/api-helpers";
import {
  MAX_ITEMS_PER_ORDER,
  MAX_ORDER_TOTAL,
  todayISO,
  type OrderLine,
} from "@/lib/types";
import { randomBytes } from "crypto";
import { z } from "zod";
import {
  checkRateLimit,
  recordAttempt,
  getClientIp,
} from "@/lib/rate-limit";
import { notifyNewOrder } from "@/lib/discord-webhook";

// Zod schema — every public input is validated before it touches the DB.
const createOrderSchema = z.object({
  customer: z.string().min(1).max(100),
  contact: z.string().min(1).max(200),
  steam: z.string().min(1).max(100),
  notes: z.string().max(1000).optional(),
  items: z
    .array(
      z.object({
        itemId: z.union([z.number(), z.string()]),
        qty: z.number(),
      })
    )
    .max(500),
  // Hidden honeypot: should stay empty. Helps filter naive bots.
  company: z.string().max(200).optional(),
});

export type CreateOrderBody = z.infer<typeof createOrderSchema>;

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
  // Anti-spam quota: max 5 order submissions per IP per 10-minute window.
  // Every attempt counts (successes included) so the endpoint can't be
  // hammered — and neither can the Discord webhook it triggers.
  const ip = getClientIp(req);
  const rl = checkRateLimit("order", ip, { max: 5, windowMs: 10 * 60 * 1000 });
  if (rl.locked) {
    return errorJson(
      `Too many orders submitted. Try again in ${rl.retryAfterMin} minute(s).`,
      429
    );
  }
  recordAttempt("order", ip, { max: 5, windowMs: 10 * 60 * 1000 });

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const parsed = createOrderSchema.safeParse(raw);
  if (!parsed.success) {
    return errorJson("Invalid request body.", 400);
  }
  const body = parsed.data;

  // Honeypot — silently accept but do nothing if filled.
  if (body.company && body.company.trim().length > 0) {
    return json({ ok: true });
  }

  const customer = (body.customer || "").trim();
  if (!customer) return errorJson("Enter your name.", 400);
  const contact = (body.contact || "").trim();
  if (!contact) return errorJson("Enter your contact information.", 400);
  const steam = (body.steam || "").trim();
  if (!steam) return errorJson("Enter your Steam ID 64.", 400);

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
  const [closedRes, maintenanceRes] = await Promise.all([
    sb
    .from("settings")
    .select("value")
    .eq("key", "site_closed")
    .maybeSingle(),
    sb
      .from("settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle(),
  ]);
  const closed =
    closedRes.data && String(closedRes.data.value).toLowerCase() === "true";
  if (closed) return errorJson("Orders are currently closed.", 400);
  if (
    maintenanceRes.data &&
    String(maintenanceRes.data.value).toLowerCase() === "true"
  ) {
    return errorJson("The order site is temporarily offline for maintenance.", 503);
  }

  // Resolve item names/prices server-side (never trust client prices).
  // Items toggled off (`active = false`) are treated as unavailable — the
  // public inventory list omits them, so a stale client page that still
  // shows them must be rejected here to prevent ordering hidden stock.
  const ids = Array.from(new Set(cleanItems.map((i) => i.itemId)));
  const invRes = await sb
    .from("inventory")
    .select("id, name, price, active")
    .in("id", ids);
  if (invRes.error || !invRes.data)
    return errorJson("Could not load inventory.", 500);
  // Key by stringified id so numeric and UUID ids both resolve.
  const invMap = new Map(invRes.data.map((i) => [String(i.id), i]));
  const lines: OrderLine[] = [];
  let total = 0;
  let hiddenCount = 0;
  for (const it of cleanItems) {
    const inv = invMap.get(String(it.itemId));
    if (!inv) continue;
    const active = (inv as { active?: boolean | null }).active;
    const isActive = active === null || active === undefined || active === true;
    if (!isActive) {
      hiddenCount += it.qty;
      continue;
    }
    lines.push({ itemId: inv.id, name: inv.name, qty: it.qty, price: inv.price });
    total += it.qty * inv.price;
  }
  if (hiddenCount > 0 && !lines.length)
    return errorJson(
      "Some selected items are no longer available for sale.",
      400
    );
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
      contact,
      steam,
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
