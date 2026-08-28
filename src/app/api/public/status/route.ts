import { getSupabase } from "@/lib/supabase";
import { etagJson } from "@/lib/api-helpers";

// Returns only the public-facing site config: open/closed + message + discord link.
// Reads `site_closed` (original schema). Falls back to `site_open` (inverted)
// so the page also works against a database that uses the opposite convention.
export async function GET(req: Request) {
  const sb = getSupabase();
  const [closedRes, openRes, maintenanceRes, messageRes, discordRes] = await Promise.all([
    sb.from("settings").select("value").eq("key", "site_closed").maybeSingle(),
    sb.from("settings").select("value").eq("key", "site_open").maybeSingle(),
    sb
      .from("settings")
      .select("value")
      .eq("key", "maintenance_mode")
      .maybeSingle(),
    sb
      .from("settings")
      .select("value")
      .eq("key", "site_closed_message")
      .maybeSingle(),
    sb.from("settings").select("value").eq("key", "discord_link").maybeSingle(),
  ]);

  let closed = false;
  if (closedRes.data && closedRes.data.value != null) {
    closed = String(closedRes.data.value).toLowerCase() === "true";
  } else if (openRes.data && openRes.data.value != null) {
    // Inverted convention: site_open=true means NOT closed.
    closed = String(openRes.data.value).toLowerCase() !== "true";
  }

  const message =
    messageRes.data && messageRes.data.value
      ? messageRes.data.value
      : "Orders are temporarily paused. Please check back soon.";
  const discordLink =
    discordRes.data && discordRes.data.value
      ? discordRes.data.value
      : "https://discord.gg/anAmr5MQF";

  const maintenance =
    maintenanceRes.data &&
    String(maintenanceRes.data.value).toLowerCase() === "true";

  return etagJson(req, { closed, maintenance, message, discordLink }, "public, no-cache");
}
