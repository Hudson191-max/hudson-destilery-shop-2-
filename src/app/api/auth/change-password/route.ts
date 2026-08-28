import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { json, errorJson, requireStaff } from "@/lib/api-helpers";
import { hashPassword, verifyPassword as verifyPw } from "@/lib/password";
import {
  checkRateLimit,
  recordFailure,
  clearFailures,
  getClientIp,
} from "@/lib/rate-limit";

// ── Self-service password change ─────────────────────────────────────────────
// Any signed-in staff member (owner or employee) can change their OWN password.
// The current password must be provided and verified — the session alone is
// not enough, so an unlocked device can't silently rotate credentials.
//
// Brute-force protection: shared limiter, 5 wrong "current password" attempts
// per 5 minutes per IP → 15-minute lockout (same policy as login).

const changePasswordSchema = z.object({
  current: z.string().min(1).max(200),
  next: z.string().min(8).max(200),
});

export async function POST(req: Request) {
  const session = await requireStaff();
  if (!session) return errorJson("Not signed in.", 401);

  const ip = getClientIp(req);
  const rl = checkRateLimit("pwchange", ip);
  if (rl.locked) {
    return errorJson(
      `Too many attempts. Try again in ${rl.retryAfterMin} minute(s).`,
      429
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const parsed = changePasswordSchema.safeParse(raw);
  if (!parsed.success) {
    return errorJson("New password must be at least 8 characters.", 400);
  }
  const { current, next } = parsed.data;

  // Login normalizes names before lookup, but the session stores the name as
  // typed — apply the same normalization here so the row is always found.
  const username = (session.user || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "");

  const sb = getSupabase();
  const res = await sb
    .from("auth")
    .select("username, password_hash, salt")
    .eq("username", username)
    .maybeSingle();

  if (res.error || !res.data) {
    // Customer "sessions" have no account row — nothing to change.
    return errorJson("Account not found.", 404);
  }

  const verified = verifyPw(current, {
    password_hash: String(res.data.password_hash || ""),
    salt: String(res.data.salt || ""),
  });
  if (!verified.ok) {
    recordFailure("pwchange", ip);
    return errorJson("Current password is incorrect.", 401);
  }
  if (current === next) {
    return errorJson("Choose a password different from the current one.", 400);
  }

  clearFailures("pwchange", ip);
  const upgraded = hashPassword(next);
  await sb
    .from("auth")
    .update({
      password_hash: upgraded.password_hash,
      salt: upgraded.salt,
    })
    .eq("username", username);

  return json({ ok: true });
}
