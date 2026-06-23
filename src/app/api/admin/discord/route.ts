import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireOwner } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: { url?: string };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const url = (body.url || "").trim();
  if (!url) return errorJson("Enter a link.", 400);

  const sb = getSupabase();
  const res = await sb
    .from("settings")
    .upsert({ key: "discord_link", value: url });
  if (res.error) return errorJson("Could not save link.", 500);

  return json({ ok: true, url });
}
