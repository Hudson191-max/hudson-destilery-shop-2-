import { getSupabase } from "@/lib/supabase";
import { errorJson, json, requireOwner } from "@/lib/api-helpers";
import { hashPassword } from "@/lib/password";

type AccountRole = "employee" | "owner";

function normalizeUsername(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "");
}

export async function GET() {
  if (!(await requireOwner())) return errorJson("Unauthorized.", 401);
  const res = await getSupabase()
    .from("auth")
    .select("username, role")
    .in("role", ["employee", "owner"])
    .order("username");
  if (res.error) return errorJson("Could not load accounts.", 500);
  return json({ accounts: res.data || [] });
}

export async function POST(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);
  let body: { username?: string; role?: AccountRole; password?: string };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const username = normalizeUsername(body.username || "");
  const password = body.password || "";
  if (!/^[a-z0-9_-]{2,32}$/.test(username))
    return errorJson("Use 2-32 letters, numbers, underscores, or hyphens.", 400);
  if (body.role !== "employee" && body.role !== "owner")
    return errorJson("Select a valid account role.", 400);
  if (password.length < 8) return errorJson("Password must be at least 8 characters.", 400);

  // scrypt hash with per-account random salt (stored inside password_hash).
  const { password_hash, salt } = hashPassword(password);
  const res = await getSupabase().from("auth").insert({
    username,
    role: body.role,
    password_hash,
    salt,
  });
  if (res.error) return errorJson("That username is already in use.", 409);
  return json({ ok: true });
}

export async function DELETE(req: Request) {
  const session = await requireOwner();
  if (!session) return errorJson("Unauthorized.", 401);
  let body: { username?: string };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const username = normalizeUsername(body.username || "");
  if (!username) return errorJson("Username is required.", 400);
  if (username === normalizeUsername(session.user))
    return errorJson("You cannot delete your own account.", 400);

  const sb = getSupabase();
  const ownerCount = await sb.from("auth").select("username").eq("role", "owner");
  const target = await sb.from("auth").select("role").eq("username", username).maybeSingle();
  if (target.data?.role === "owner" && (ownerCount.data || []).length <= 1)
    return errorJson("At least one owner account must remain.", 400);
  const res = await sb.from("auth").delete().eq("username", username);
  if (res.error) return errorJson("Could not delete account.", 500);
  return json({ ok: true });
}

export async function PATCH(req: Request) {
  if (!(await requireOwner())) return errorJson("Unauthorized.", 401);
  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const username = normalizeUsername(body.username || "");
  const password = body.password || "";
  if (!username) return errorJson("Username is required.", 400);
  if (password.length < 8) return errorJson("Password must be at least 8 characters.", 400);

  const { password_hash, salt } = hashPassword(password);
  const res = await getSupabase()
    .from("auth")
    .update({ password_hash, salt })
    .eq("username", username);
  if (res.error) return errorJson("Could not reset password.", 500);
  return json({ ok: true });
}