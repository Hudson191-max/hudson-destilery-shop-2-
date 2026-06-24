import { json, errorJson, requireStaff } from "@/lib/api-helpers";
import { getSupabase } from "@/lib/supabase";

// ── Discord invite validity checker ──────────────────────────────────────────
// Pings Discord's public invite API to check if an invite link is still valid.
// No auth required by Discord; rate-limited to ~1 req per call (fine for our use).
//
// Response shape:
//   { valid: boolean, guildName: string|null, expiresAt: string|null,
//     approximateMembers: number|null, checkedAt: number, code: string }

interface DiscordInviteResponse {
  code?: string;
  guild?: { name?: string; approximate_member_count?: number };
  expires_at?: string | null;
  message?: string;
}

export async function GET() {
  const session = await requireStaff();
  if (!session) return errorJson("Unauthorized.", 401);

  const sb = getSupabase();
  const { data } = await sb
    .from("settings")
    .select("value")
    .eq("key", "discord_link")
    .maybeSingle();

  const rawUrl = String(data?.value || "").trim();
  if (!rawUrl) {
    return json({
      valid: false,
      reason: "no_link",
      checkedAt: Date.now(),
    });
  }

  // Extract the invite code from various Discord URL formats:
  //   https://discord.gg/abc123
  //   https://discord.com/invite/abc123
  //   https://discordapp.com/invite/abc123
  //   abc123
  const codeMatch = rawUrl.match(
    /(?:discord\.gg|discord\.com\/invite|discordapp\.com\/invite)\/([a-zA-Z0-9-]+)/
  );
  const code = codeMatch ? codeMatch[1] : rawUrl.replace(/^https?:\/\//, "");

  if (!code) {
    return json({
      valid: false,
      reason: "invalid_format",
      checkedAt: Date.now(),
    });
  }

  try {
    const res = await fetch(
      `https://discord.com/api/v9/invites/${encodeURIComponent(
        code
      )}?with_counts=true&with_expiration=true`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "User-Agent": "HudsonDistilleryBot/1.0",
        },
        cache: "no-store",
      }
    );

    if (res.status === 404) {
      return json({
        valid: false,
        reason: "expired_or_invalid",
        code,
        checkedAt: Date.now(),
      });
    }

    if (res.status === 429) {
      const body = (await res.json().catch(() => ({}))) as DiscordInviteResponse;
      return json({
        valid: false,
        reason: "rate_limited",
        retryAfter: body.message || "try again later",
        checkedAt: Date.now(),
      });
    }

    if (!res.ok) {
      return json({
        valid: false,
        reason: `http_${res.status}`,
        checkedAt: Date.now(),
      });
    }

    const body = (await res.json()) as DiscordInviteResponse;
    return json({
      valid: true,
      code: body.code || code,
      guildName: body.guild?.name || null,
      approximateMembers: body.guild?.approximate_member_count ?? null,
      expiresAt: body.expires_at || null,
      checkedAt: Date.now(),
    });
  } catch {
    return json({
      valid: false,
      reason: "network_error",
      checkedAt: Date.now(),
    });
  }
}
