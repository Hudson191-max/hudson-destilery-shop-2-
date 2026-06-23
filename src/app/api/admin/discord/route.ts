import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireOwner } from "@/lib/api-helpers";

// Saves both the public Discord invite link AND the staff webhook URL.
// Both live in the settings table under separate keys.
export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: { url?: string; webhookUrl?: string };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }

  const sb = getSupabase();
  const updates: Promise<unknown>[] = [];

  if (body.url !== undefined) {
    const url = (body.url || "").trim();
    if (!url) return errorJson("Enter a link.", 400);
    updates.push(sb.from("settings").upsert({ key: "discord_link", value: url }));
  }

  if (body.webhookUrl !== undefined) {
    const webhookUrl = (body.webhookUrl || "").trim();
    // Empty string = clear the webhook. Otherwise must be a valid Discord webhook URL.
    if (webhookUrl && !/^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\//i.test(webhookUrl)) {
      return errorJson("Webhook URL must be a Discord webhook (https://discord.com/api/webhooks/...).", 400);
    }
    updates.push(
      sb.from("settings").upsert({ key: "discord_webhook_url", value: webhookUrl })
    );
  }

  if (updates.length === 0) {
    return errorJson("Nothing to save.", 400);
  }

  const results = await Promise.all(updates);
  for (const r of results) {
    if (r && typeof r === "object" && "error" in r && (r as { error: unknown }).error) {
      return errorJson("Could not save settings.", 500);
    }
  }

  return json({
    ok: true,
    url: body.url,
    webhookUrl: body.webhookUrl,
  });
}
