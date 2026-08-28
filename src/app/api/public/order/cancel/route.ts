import { getSupabase } from "@/lib/supabase";
import { json, errorJson } from "@/lib/api-helpers";
import { todayISO } from "@/lib/types";
import {
  checkRateLimit,
  recordFailure,
  clearFailures,
  getClientIp,
} from "@/lib/rate-limit";

// Public cancellation. Verifies the cancel code server-side.
// Only selects cancel_code + status — never returns them to the client.
// Failed attempts are rate-limited (10 per 10 min per IP → 15-min lockout)
// so the 8-char code can't be brute-forced.
export async function POST(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit("cancel", ip, { max: 10, windowMs: 10 * 60 * 1000 });
  if (rl.locked) {
    return errorJson(
      `Too many attempts. Try again in ${rl.retryAfterMin} minute(s).`,
      429
    );
  }

  let body: { id?: number | string; code?: string };
  try {
    body = await req.json();
  } catch {
    return errorJson("Invalid request body.", 400);
  }
  const id = body.id == null ? "" : String(body.id).trim();
  const code = (body.code || "").trim().toUpperCase();
  if (!id) return errorJson("Please enter an order number.", 400);
  if (!code) return errorJson("Enter the cancellation code.", 400);

  const sb = getSupabase();
  const check = await sb
    .from("orders")
    .select("cancel_code, status")
    .eq("id", id)
    .maybeSingle();
  if (check.error || !check.data) {
    recordFailure("cancel", ip, { max: 10, windowMs: 10 * 60 * 1000 });
    return errorJson("Could not find that order.", 404);
  }

  if (String(check.data.status || "").toLowerCase() === "cancelled") {
    recordFailure("cancel", ip, { max: 10, windowMs: 10 * 60 * 1000 });
    return errorJson("This order is already cancelled.", 400);
  }

  const stored = String(check.data.cancel_code || "").toUpperCase();
  // Constant-time comparison so response timing can't leak the code.
  let codeOk = false;
  if (stored) {
    try {
      const a = Buffer.from(code);
      const b = Buffer.from(stored);
      codeOk = a.length === b.length && a.equals(b);
    } catch {
      codeOk = false;
    }
  }
  if (!stored || !codeOk) {
    recordFailure("cancel", ip, { max: 10, windowMs: 10 * 60 * 1000 });
    return errorJson("That cancellation code is incorrect.", 400);
  }

  const upd = await sb
    .from("orders")
    .update({ status: "Cancelled", closed_at: Date.now() })
    .eq("id", id);
  if (upd.error) return errorJson("Could not cancel this order.", 500);

  clearFailures("cancel", ip);
  return json({ ok: true, id, date: todayISO() });
}
