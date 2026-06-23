import { attemptLogin, setSession, type Role } from "@/lib/auth";
import { json, errorJson } from "@/lib/api-helpers";

export async function POST(req: Request) {
  let body: { role?: Role; name?: string; pw?: string };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const role = body.role;
  if (role !== "employee" && role !== "owner" && role !== "customer")
    return errorJson("Select a valid role.", 400);

  // SECURITY: on any failure we return the same generic message and never
  // reveal whether the name was whitelisted, the password was wrong, etc.
  const session = await attemptLogin(role, body.name || "", body.pw || "");
  if (!session) return errorJson("Invalid credentials.", 401);

  await setSession(session);
  return json({ user: session.user, role: session.role });
}
