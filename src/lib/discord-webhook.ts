import { getSupabase } from "./supabase";
import { CURRENCY, type OrderLine } from "./types";
import sharp from "sharp";

// ── Discord webhook helper ───────────────────────────────────────────────────
// Two separate webhook URLs are supported so staff can route notifications to
// different Discord channels:
//
//   • discord_webhook_url        — real-time pings when new orders come in
//   • discord_backup_webhook_url — daily JSON backup file attachment
//
// If the backup webhook is empty, backups fall back to the orders webhook so
// nothing breaks in single-channel setups.
//
// All network failures are swallowed — a notification failure must NEVER break
// the user's order flow or admin action. We just try, and move on.

interface OrderNotificationData {
  orderId: number | string;
  customer: string;
  contact?: string | null;
  steam?: string | null;
  notes?: string | null;
  lines: OrderLine[];
  total: number;
  createdBy?: string | null;
}

async function getSetting(key: string): Promise<string | null> {
  const sb = getSupabase();
  const { data } = await sb
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  const url = String(data?.value || "").trim();
  if (!url || !url.startsWith("http")) return null;
  return url;
}

// Webhook for real-time order pings.
async function getOrderWebhookUrl(): Promise<string | null> {
  return getSetting("discord_webhook_url");
}

// Webhook for daily backup file attachments. Falls back to the orders webhook
// when not configured, so a single-webhook setup still receives backups.
async function getBackupWebhookUrl(): Promise<string | null> {
  const dedicated = await getSetting("discord_backup_webhook_url");
  if (dedicated) return dedicated;
  return getOrderWebhookUrl();
}

function buildOrderEmbed(d: OrderNotificationData) {
  const itemsText = d.lines
    .map((l) => `• ${l.name} ×${l.qty} — ${(l.qty * l.price).toLocaleString()} ${CURRENCY}`)
    .join("\n");

  const fields: { name: string; value: string; inline?: boolean }[] = [
    { name: "Customer", value: d.customer, inline: true },
    { name: "Total", value: `${d.total.toLocaleString()} ${CURRENCY}`, inline: true },
  ];
  if (d.contact) fields.push({ name: "Contact", value: d.contact, inline: true });
  if (d.steam) fields.push({ name: "Steam ID", value: `\`${d.steam}\``, inline: true });
  if (d.createdBy) fields.push({ name: "Created by", value: d.createdBy, inline: true });

  return {
    title: `🥃 New Order #${d.orderId}`,
    description: itemsText || "_No items_",
    color: 0xc8a84b, // distillery gold
    fields,
    footer: { text: d.notes ? `📝 ${d.notes.slice(0, 200)}` : "The Hudson Distillery" },
    timestamp: new Date().toISOString(),
  };
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function buildReceiptImage(d: OrderNotificationData): Promise<Buffer> {
  const rowHeight = 34;
  const top = 190;
  const height = top + d.lines.length * rowHeight + 130;
  const rows = d.lines
    .map((line, index) => {
      const y = top + index * rowHeight;
      const name = `${line.name} x${line.qty}`;
      const price = `${(line.qty * line.price).toLocaleString()} ${CURRENCY}`;
      return `<text x="40" y="${y}" class="item">${escapeXml(name)}</text>` +
        `<text x="760" y="${y}" text-anchor="end" class="item">${escapeXml(price)}</text>` +
        `<line x1="40" y1="${y + 12}" x2="760" y2="${y + 12}" class="rule"/>`;
    })
    .join("");
  const totalY = top + d.lines.length * rowHeight + 34;
  const svg = `<svg width="800" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <style>
      .title{font:700 25px Arial,sans-serif;fill:#171717}.sub{font:14px Arial,sans-serif;fill:#666}
      .label{font:700 13px Arial,sans-serif;fill:#555}.value{font:13px Arial,sans-serif;fill:#171717}
      .item{font:13px Arial,sans-serif;fill:#171717}.rule{stroke:#ddd;stroke-width:1}
      .total{font:700 18px Arial,sans-serif;fill:#171717}
    </style>
    <rect width="800" height="${height}" fill="#fff"/>
    <text x="40" y="48" class="title">THE HUDSON DISTILLERY</text>
    <text x="40" y="72" class="sub">Order receipt #${escapeXml(String(d.orderId))} - ${new Date().toISOString().slice(0, 10)}</text>
    <line x1="40" y1="92" x2="760" y2="92" class="rule"/>
    <text x="40" y="125" class="label">Customer</text><text x="760" y="125" text-anchor="end" class="value">${escapeXml(d.customer)}</text>
    <text x="40" y="151" class="label">Status</text><text x="760" y="151" text-anchor="end" class="value">Waiting on Payment</text>
    ${rows}
    <line x1="40" y1="${totalY - 12}" x2="760" y2="${totalY - 12}" stroke="#777" stroke-width="2"/>
    <text x="40" y="${totalY + 18}" class="total">Total</text><text x="760" y="${totalY + 18}" text-anchor="end" class="total">${d.total.toLocaleString()} ${CURRENCY}</text>
    <text x="40" y="${totalY + 62}" class="sub">Thanks for ordering with us. Keep this receipt for your records.</text>
  </svg>`;
  return sharp(Buffer.from(svg)).png().toBuffer();
}

export async function notifyNewOrder(d: OrderNotificationData): Promise<void> {
  try {
    const url = await getOrderWebhookUrl();
    if (!url) return; // No webhook configured — silent no-op.

    const form = new FormData();
    form.append(
      "payload_json",
      JSON.stringify({
        username: "Hudson Distillery",
        content: `🥃 **New order #${d.orderId}** from **${d.customer}** — ${d.lines.length} item(s), ${d.total.toLocaleString()} ${CURRENCY}`,
        embeds: [buildOrderEmbed(d)],
      })
    );
    try {
      const receipt = await buildReceiptImage(d);
      form.append(
        "file",
        new Blob([receipt], { type: "image/png" }),
        `order-${d.orderId}-receipt.png`
      );
    } catch {
      // Keep the text notification if image rendering is unavailable.
    }

    const res = await fetch(url, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    // Discord returns 204 No Content on success. Anything else we ignore —
    // a broken webhook must not break order creation.
    void res;
  } catch {
    // Network error, DNS failure, etc. — silent.
  }
}

// ── Backup notification (used by the daily cron) ─────────────────────────────
// Uses the dedicated backup webhook when set, otherwise falls back to the
// orders webhook. Returns an explicit ok/error so the cron route can report
// delivery failures (unlike order pings, a failed backup is something the
// owner genuinely needs to know about).
export async function notifyBackupAttachment(
  jsonContent: string,
  filename: string
): Promise<{ ok: boolean; error?: string; usedFallback: boolean }> {
  try {
    const dedicated = await getSetting("discord_backup_webhook_url");
    const url = dedicated ? dedicated : await getOrderWebhookUrl();
    if (!url) return { ok: false, error: "No webhook URL configured.", usedFallback: false };

    // Discord webhooks accept multipart/form-data with a file payload field.
    // The JSON content is sent as an uploaded file attachment.
    const form = new FormData();
    form.append(
      "payload_json",
      JSON.stringify({
        username: "Hudson Distillery",
        content: `📦 **Daily backup** — ${new Date().toLocaleDateString("en-GB")} • ${filename}`,
      })
    );
    form.append("file", new Blob([jsonContent], { type: "application/json" }), filename);

    const res = await fetch(url, {
      method: "POST",
      body: form,
      cache: "no-store",
    });
    if (!res.ok && res.status !== 204) {
      return {
        ok: false,
        error: `Discord returned HTTP ${res.status}`,
        usedFallback: !dedicated,
      };
    }
    return { ok: true, usedFallback: !dedicated };
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "network error",
      usedFallback: false,
    };
  }
}
