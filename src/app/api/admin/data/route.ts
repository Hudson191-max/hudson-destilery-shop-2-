import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireStaff } from "@/lib/api-helpers";
import {
  parseLines,
  orderTotal,
  type InventoryRow,
  type OrderRow,
  type StockLogRow,
} from "@/lib/types";

// Server-side cleanup: delete closed orders older than 7 days.
// Replaces the original client-side setInterval auto-deletion (which is a
// security/consistency anti-pattern). Runs once per admin data fetch.
async function cleanupOldOrders(): Promise<void> {
  const sb = getSupabase();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - oneWeekMs;
  try {
    await sb
      .from("orders")
      .delete()
      .in("status", ["Done", "Cancelled"])
      .lt("closed_at", cutoff);
  } catch {
    // Non-fatal — best-effort cleanup.
  }
}

export async function GET() {
  const session = await requireStaff();
  if (!session) return errorJson("Unauthorized.", 401);

  await cleanupOldOrders();

  const sb = getSupabase();
  const [invRes, ordRes, logRes, closedRes, openRes, messageRes, discordRes, webhookRes] =
    await Promise.all([
      sb.from("inventory").select("*").order("id"),
      sb.from("orders").select("*").order("id"),
      sb
        .from("stock_log")
        .select("*")
        .order("id", { ascending: false })
        .limit(200),
      sb.from("settings").select("value").eq("key", "site_closed").maybeSingle(),
      sb.from("settings").select("value").eq("key", "site_open").maybeSingle(),
      sb
        .from("settings")
        .select("value")
        .eq("key", "site_closed_message")
        .maybeSingle(),
      sb.from("settings").select("value").eq("key", "discord_link").maybeSingle(),
      sb.from("settings").select("value").eq("key", "discord_webhook_url").maybeSingle(),
    ]);

  const inventory = (invRes.data || []) as InventoryRow[];
  const orders = (ordRes.data || []) as OrderRow[];
  const stockLog = (logRes.data || []) as StockLogRow[];

  // Pre-compute parsed lines + total so the client doesn't re-parse.
  const ordersWithTotals = orders.map((o) => ({
    ...o,
    parsedLines: parseLines(o),
    total: orderTotal(parseLines(o)),
  }));

  let closed = false;
  if (closedRes.data && closedRes.data.value != null) {
    closed = String(closedRes.data.value).toLowerCase() === "true";
  } else if (openRes.data && openRes.data.value != null) {
    closed = String(openRes.data.value).toLowerCase() !== "true";
  }
  const closedMessage =
    messageRes.data && messageRes.data.value
      ? messageRes.data.value
      : "Orders are temporarily paused. Please check back soon.";
  const discordLink =
    discordRes.data && discordRes.data.value
      ? discordRes.data.value
      : "https://discord.gg/anAmr5MQF";
  const discordWebhookUrl =
    webhookRes.data && webhookRes.data.value ? webhookRes.data.value : "";

  return json({
    inventory,
    orders: ordersWithTotals,
    stockLog,
    siteStatus: { closed, message: closedMessage },
    discordLink,
    discordWebhookUrl,
    role: session.role,
    user: session.user,
  });
}
