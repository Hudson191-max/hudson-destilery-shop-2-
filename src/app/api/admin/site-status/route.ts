import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireOwner } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: { closed?: boolean; message?: string };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const closed = !!body.closed;
  const message =
    (body.message || "").trim() ||
    "Orders are temporarily paused. Please check back soon.";

  const sb = getSupabase();
  await Promise.all([
    sb.from("settings").upsert({ key: "site_closed", value: String(closed) }),
    sb.from("settings").upsert({ key: "site_closed_message", value: message }),
  ]);

  return json({ ok: true, closed, message });
}
