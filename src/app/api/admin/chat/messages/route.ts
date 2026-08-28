import { getSupabase } from "@/lib/supabase";
import { etagJson, errorJson, requireStaff } from "@/lib/api-helpers";

export interface ChatMessage {
  id: number;
  author: string;
  content: string;
  created_at: number;
}

export async function GET(req: Request) {
  const session = await requireStaff();
  if (!session) return errorJson("Unauthorized.", 401);

  const url = new URL(req.url);
  const limit = Math.min(parseInt(url.searchParams.get("limit") || "50"), 100);
  const offset = parseInt(url.searchParams.get("offset") || "0");

  const sb = getSupabase();
  const { data, error } = await sb
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) return errorJson("Failed to fetch messages.", 500);

  // Reverse to get chronological order (oldest first). ETag revalidation:
  // this endpoint is polled every 2s — when nobody has sent a new message the
  // poll is answered by a ~50-byte 304 instead of the full transcript.
  return etagJson(req, (data || []).reverse());
}
