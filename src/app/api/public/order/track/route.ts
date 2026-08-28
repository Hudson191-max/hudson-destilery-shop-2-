import { getSupabase } from "@/lib/supabase";
import { json, errorJson } from "@/lib/api-helpers";
import { parseLines, orderTotal, type PublicOrder } from "@/lib/types";
import {
  checkRateLimit,
  recordFailure,
  clearFailures,
  getClientIp,
} from "@/lib/rate-limit";
import { timingSafeEqual } from "crypto";

// Public order tracking — requires BOTH the order number and the cancellation
// code that was issued when the order was placed. Order IDs alone are
// sequential, so an ID-only endpoint would let anyone enumerate other
// customers' orders. With the code required, only the person who placed the
// order can view it. Failed attempts are rate-limited.
//
// Returns ONLY: id, customer, status, date, lines (name/qty/price), total.
// Sensitive fields (contact, steam, notes) are NEVER selected, and the
// cancel code itself is never echoed back.
export async function GET(req: Request) {
  const ip = getClientIp(req);
  const rl = checkRateLimit("track", ip, { max: 30, windowMs: 5 * 60 * 1000 });
  if (rl.locked) {
    return errorJson(
      `Too many lookup attempts. Try again in ${rl.retryAfterMin} minute(s).`,
      429
    );
  }

  const { searchParams } = new URL(req.url);
  const rawId = searchParams.get("id");
  const id = rawId ? rawId.trim() : "";
  const rawCode = searchParams.get("code");
  const code = (rawCode ? rawCode.trim() : "").toUpperCase();
  if (!id) return errorJson("Please enter an order number.", 400);
  if (!code)
    return errorJson("Enter the cancellation code from your order.", 400);

  const sb = getSupabase();
  const res = await sb
    .from("orders")
    .select("id, customer, status, date, lines, cancel_code")
    .eq("id", id)
    .maybeSingle();

  // Generic message for both "no such order" and "wrong code" so the endpoint
  // can't be used to discover which order IDs exist.
  const rejected = () => errorJson("Order not found, or the code is incorrect.", 404);

  if (res.error || !res.data) {
    recordFailure("track", ip, { max: 30 });
    return rejected();
  }

  const stored = String(res.data.cancel_code || "").toUpperCase();
  let codeOk = false;
  if (stored) {
    try {
      const a = Buffer.from(code);
      const b = Buffer.from(stored);
      codeOk = a.length === b.length && timingSafeEqual(a, b);
    } catch {
      codeOk = false;
    }
  }
  if (!stored || !codeOk) {
    recordFailure("track", ip, { max: 30 });
    return rejected();
  }

  clearFailures("track", ip);

  const lines = parseLines({ lines: res.data.lines });
  const order: PublicOrder = {
    id: res.data.id,
    customer: res.data.customer || "—",
    status: String(res.data.status || "Preparing"),
    date: res.data.date || null,
    lines,
    total: orderTotal(lines),
  };
  return json({ order });
}
