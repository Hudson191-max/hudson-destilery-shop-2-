import { attemptLogin, setSession, type Role } from "@/lib/auth";
import { json, errorJson } from "@/lib/api-helpers";
import {
  checkRateLimit,
  recordFailure,
  clearFailures,
  getClientIp,
} from "@/lib/rate-limit";

// ── Brute-force protection ───────────────────────────────────────────────────
// Shared sliding-window limiter (lib/rate-limit.ts): 5 failures per 5 minutes
// per IP → 15-minute lockout. In-memory, so it's per-instance on serverless —
// best-effort by design, documented in the lib.

export async function POST(req: Request) {
  // Rate-limit check BEFORE any auth logic.
  const ip = getClientIp(req);
  const rl = checkRateLimit("login", ip);
  if (rl.locked) {
    return errorJson(
      `Too many failed attempts. Try again in ${rl.retryAfterMin} minute(s).`,
      429
    );
  }

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
  try {
    const session = await attemptLogin(role, body.name || "", body.pw || "");
    if (!session) {
      recordFailure("login", ip);
      return errorJson("Invalid credentials.", 401);
    }

    clearFailures("login", ip);
    await setSession(session);
    return json({ user: session.user, role: session.role });
  } catch (err) {
    // Misconfiguration (e.g. missing HD_SESSION_SECRET) must reach the owner
    // as an actionable message — everything else stays generic. Full details
    // go to the server logs.
    console.error("[login] error:", err);
    const msg = err instanceof Error ? err.message : "";
    if (msg.startsWith("HD_SESSION_SECRET")) return errorJson(msg, 500);
    return errorJson("Login failed. Please try again.", 500);
  }
}
