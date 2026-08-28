import { getSupabase } from "./supabase";

// Server-side cleanup: delete closed orders older than 7 days.
// Runs from the daily backup cron (primary) and once per admin data fetch
// (fallback) so closed orders never accumulate unbounded.
export async function cleanupOldOrders(): Promise<void> {
  const sb = getSupabase();
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;
  const cutoff = Date.now() - oneWeekMs;
  try {
    await sb
      .from("orders")
      .delete()
      .in("status", ["Done", "Cancelled"])
      .lt("closed_at", cutoff);
  } catch {
    // Non-fatal — best-effort cleanup.
  }
}
