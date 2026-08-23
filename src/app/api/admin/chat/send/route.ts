import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireStaff } from "@/lib/api-helpers";

export async function POST(req: Request) {
  const session = await requireStaff();
  if (!session) return errorJson("Unauthorized.", 401);

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }

  const { content } = body as Record<string, unknown>;

  if (!content || typeof content !== "string") {
    return errorJson("Message content is required.", 400);
  }

  if (content.trim().length === 0) {
    return errorJson("Message cannot be empty.", 400);
  }

  if (content.length > 1000) {
    return errorJson("Message is too long (max 1000 characters).", 400);
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from("messages")
    .insert({
      author: session.user,
      content: content.trim(),
      created_at: Date.now(),
    })
    .select()
    .single();

  if (error) return errorJson("Failed to send message.", 500);

  return json(data, 201);
}
