"use client";
// Discord settings modal (owner): public invite link, order webhook and
// optional backup webhook. Saving also refreshes the 30-day reminder marker
// (handled by the parent via onSaved → markSaved).
import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";

interface DiscordProps {
  open: boolean;
  currentUrl: string;
  currentWebhookUrl: string;
  currentBackupWebhookUrl: string;
  onClose: () => void;
  onSaved: (
    url: string,
    webhookUrl: string,
    backupWebhookUrl: string
  ) => void;
}

export function DiscordModal({
  open,
  currentUrl,
  currentWebhookUrl,
  currentBackupWebhookUrl,
  onClose,
  onSaved,
}: DiscordProps) {
  const [url, setUrl] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [backupWebhookUrl, setBackupWebhookUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setUrl(currentUrl || "");
      setWebhookUrl(currentWebhookUrl || "");
      setBackupWebhookUrl(currentBackupWebhookUrl || "");
    }
  }, [open]);

  async function submit() {
    if (!url.trim()) {
      toast("Enter a Discord invite link", "err");
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/admin/discord", {
        method: "POST",
        body: {
          url: url.trim(),
          webhookUrl: webhookUrl.trim(),
          backupWebhookUrl: backupWebhookUrl.trim(),
        },
      });
      onSaved(
        url.trim(),
        webhookUrl.trim(),
        backupWebhookUrl.trim()
      );
      toast("Discord settings saved", "ok");
      onClose();
    } catch (e) {
      const err = e as ApiError;
      toast("Save failed", "err", err.detail || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Discord settings"
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-accent"
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? "Saving…" : "Save"}
          </button>
        </>
      }
    >
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Discord invite link (public)</label>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://discord.gg/..."
        />
        <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>
          Shown on the customer order page. Update it whenever your invite expires.
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Order webhook URL <span style={{ color: "var(--text2)" }}>(private — #orders channel)</span></label>
        <input
          type="url"
          value={webhookUrl}
          onChange={(e) => setWebhookUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
        />
        <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>
          <strong>How to create:</strong> Discord server → channel settings →
          Integrations → Webhooks → New Webhook → Copy URL.
          <br />
          When set, new orders auto-ping this channel. Leave empty to disable.
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>
          Backup webhook URL{" "}
          <span style={{ color: "var(--text2)" }}>
            (optional — #backups channel)
          </span>
        </label>
        <input
          type="url"
          value={backupWebhookUrl}
          onChange={(e) => setBackupWebhookUrl(e.target.value)}
          placeholder="https://discord.com/api/webhooks/..."
        />
        <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>
          Used for the daily auto-backup file attachment. When empty, backups
          fall back to the order webhook above — so set this only if you want
          backups in a separate (e.g. muteable) channel.
        </div>
      </div>
    </Modal>
  );
}
