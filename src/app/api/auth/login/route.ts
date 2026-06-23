import { attemptLogin, setSession, type Role } from "@/lib/auth";
import { json, errorJson } from "@/lib/api-helpers";

// ── Simple brute-force protection ────────────────────────────────────────────
// Tracks failed attempts per IP in module-scoped memory. Each instance (Vercel
// serverless function container) keeps its own map, so this is best-effort —
// not as strong as a Redis-backed limiter, but raises the bar significantly.
// Limits: 5 failures per 5 minutes → 15-minute lockout.
const MAX_FAILURES = 5;
const WINDOW_MS = 5 * 60 * 1000;
const LOCKOUT_MS = 15 * 60 * 1000;
const attempts = new Map<string, { count: number; firstAt: number; lockedUntil: number }>();

function getClientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

function checkRateLimit(ip: string): { locked: boolean; retryAfterMin?: number } {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (entry && entry.lockedUntil > now) {
    return { locked: true, retryAfterMin: Math.ceil((entry.lockedUntil - now) / 60000) };
  }
  return { locked: false };
}

function recordFailure(ip: string) {
  const now = Date.now();
  const entry = attempts.get(ip);
  if (!entry || now - entry.firstAt > WINDOW_MS) {
    attempts.set(ip, { count: 1, firstAt: now, lockedUntil: 0 });
    return;
  }
  entry.count++;
  if (entry.count >= MAX_FAILURES) {
    entry.lockedUntil = now + LOCKOUT_MS;
  }
}

function clearFailures(ip: string) {
  attempts.delete(ip);
}

export async function POST(req: Request) {
  // Rate-limit check BEFORE any auth logic.
  const ip = getClientIp(req);
  const rl = checkRateLimit(ip);
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
  const session = await attemptLogin(role, body.name || "", body.pw || "");
  if (!session) {
    recordFailure(ip);
    return errorJson("Invalid credentials.", 401);
  }

  clearFailures(ip);
  await setSession(session);
  return json({ user: session.user, role: session.role });
}
