import { getSupabase } from "@/lib/supabase";
import { etagJson, errorJson, requireStaff } from "@/lib/api-helpers";
import { cleanupOldOrders } from "@/lib/cleanup";
import {
  parseLines,
  orderTotal,
  type InventoryRow,
  type OrderRow,
  type StockLogRow,
} from "@/lib/types";

// Safety cap: the newest 1000 orders. The dashboard works on recent orders
// anyway; unbounded "select all" would grow forever without this.
const MAX_ORDERS_RETURNED = 1000;

// cleanupOldOrders issues a DELETE on every admin/data call — pointless load
// for a job that only ever needs to run occasionally. Throttle it to at most
// once every 5 minutes per process; the daily backup cron remains the primary
// driver, so this is just a safety net.
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;
const cleanupState = globalThis as typeof globalThis & {
  __hdLastCleanup?: number;
};

export async function GET(req: Request) {
  const session = await requireStaff();
  if (!session) return errorJson("Unauthorized.", 401);

  const now = Date.now();
  if (!cleanupState.__hdLastCleanup || now - cleanupState.__hdLastCleanup > CLEANUP_INTERVAL_MS) {
    cleanupState.__hdLastCleanup = now;
    await cleanupOldOrders();
  }

  const sb = getSupabase();
  const SETTING_KEYS = [
    "site_closed",
    "site_open",
    "maintenance_mode",
    "site_closed_message",
    "discord_link",
    "discord_webhook_url",
    "discord_backup_webhook_url",
  ];
  const [invRes, ordRes, logRes, settingsRes] = await Promise.all([
    sb.from("inventory").select("*").order("id"),
    // Newest first, capped — the client re-sorts as needed.
    sb
      .from("orders")
      .select("*")
      .order("id", { ascending: false })
      .limit(MAX_ORDERS_RETURNED),
    sb
      .from("stock_log")
      .select("*")
      .order("id", { ascending: false })
      .limit(200),
    // One query instead of ten maybeSingle round-trips.
    sb.from("settings").select("key,value").in("key", SETTING_KEYS),
  ]);

  const inventory = (invRes.data || []) as InventoryRow[];
  const orders = (ordRes.data || []) as OrderRow[];
  const stockLog = (logRes.data || []) as StockLogRow[];
  const settingsMap = new Map(
    ((settingsRes.data || []) as { key: string; value: string }[]).map((s) => [
      s.key,
      s.value,
    ])
  );
  const setting = (key: string): string | null => settingsMap.get(key) ?? null;

  // Pre-compute parsed lines + total so the client doesn't re-parse.
  // (parseLines used to run twice per order — once for lines, once for total.)
  const ordersWithTotals = orders.map((o) => {
    const parsed = parseLines(o);
    return { ...o, parsedLines: parsed, total: orderTotal(parsed) };
  });

  let closed = false;
  const closedVal = setting("site_closed");
  const openVal = setting("site_open");
  if (closedVal != null) {
    closed = String(closedVal).toLowerCase() === "true";
  } else if (openVal != null) {
    closed = String(openVal).toLowerCase() !== "true";
  }
  const closedMessage =
    setting("site_closed_message") ||
    "Orders are temporarily paused. Please check back soon.";
  const maintenance =
    String(setting("maintenance_mode") || "").toLowerCase() === "true";
  const discordLink =
    setting("discord_link") || "https://discord.gg/anAmr5MQF";
  const discordWebhookUrl = setting("discord_webhook_url") || "";
  const discordBackupWebhookUrl =
    setting("discord_backup_webhook_url") || "";

  // ETag revalidation: staff polls every 12s — unchanged data now costs a
  // 304 (no body) instead of re-transferring up to 1000 orders.
  return etagJson(req, {
    inventory,
    orders: ordersWithTotals,
    stockLog,
    siteStatus: { closed, maintenance, message: closedMessage },
    discordLink,
    discordWebhookUrl,
    discordBackupWebhookUrl,
    role: session.role,
    user: session.user,
  });
}
