import { getSupabase } from "@/lib/supabase";
import { json, errorJson } from "@/lib/api-helpers";
import { notifyBackupAttachment } from "@/lib/discord-webhook";

// ── Daily backup cron (Vercel Cron) ──────────────────────────────────────────
// Runs once a day via Vercel's cron system (see vercel.json).
// Generates a full backup of inventory + orders + stock_log + settings, then
// uploads it as a JSON file attachment to the staff Discord webhook channel.
//
// Security: protected by CRON_SECRET env var. Vercel sends this in the
// `Authorization: Bearer <CRON_SECRET>` header on every cron invocation.
// Without it, the route returns 401.

export async function GET(req: Request) {
  // Verify the CRON_SECRET.
  const authHeader = req.headers.get("authorization") || "";
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return errorJson("CRON_SECRET not configured.", 500);
  }
  const token = authHeader.replace(/^Bearer\s+/i, "");
  if (token !== secret) {
    return errorJson("Unauthorized.", 401);
  }

  const sb = getSupabase();
  const [invRes, ordRes, logRes, setRes] = await Promise.all([
    sb.from("inventory").select("*").order("id"),
    sb.from("orders").select("*").order("id"),
    sb
      .from("stock_log")
      .select("*")
      .order("id", { ascending: false })
      .limit(5000),
    // Don't export the auth table (password hashes) — security.
    // Only export non-sensitive settings.
    sb
      .from("settings")
      .select("key,value")
      .in("key", [
        "site_closed",
        "site_closed_message",
        "discord_link",
        "auth_whitelist",
      ]),
  ]);

  const backup = {
    exportedAt: new Date().toISOString(),
    version: 2,
    inventory: invRes.data || [],
    orders: ordRes.data || [],
    stockLog: logRes.data || [],
    settings: setRes.data || [],
  };

  const jsonContent = JSON.stringify(backup, null, 2);
  const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  const filename = `hudson-backup-${dateStr}.json`;

  const result = await notifyBackupAttachment(jsonContent, filename);
  if (!result.ok) {
    return errorJson(
      `Backup generated but delivery failed: ${result.error}`,
      500
    );
  }

  return json({
    ok: true,
    filename,
    size: jsonContent.length,
    orders: backup.orders.length,
    inventory: backup.inventory.length,
    usedFallbackWebhook: result.usedFallback,
  });
}
