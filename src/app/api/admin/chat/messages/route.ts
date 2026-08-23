import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireStaff } from "@/lib/api-helpers";

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

  // Reverse to get chronological order (oldest first)
  return json((data || []).reverse());
}
