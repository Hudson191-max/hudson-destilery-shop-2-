"use client";
// Order-site status modal (owner): open/closed switch, maintenance mode,
// quick preset messages, and the customer-facing banner text.
import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { SITE_STATUS_PRESETS } from "../admin-helpers";

const DEFAULT_CLOSED_MESSAGE =
  "Orders are temporarily paused. Please check back soon.";

interface SiteStatusProps {
  open: boolean;
  closed: boolean;
  maintenance: boolean;
  message: string;
  onClose: () => void;
  onSaved: (closed: boolean, maintenance: boolean, message: string) => void;
}

export function SiteStatusModal({
  open,
  closed,
  maintenance,
  message,
  onClose,
  onSaved,
}: SiteStatusProps) {
  const [statusValue, setStatusValue] = useState<"open" | "closed">("open");
  const [maintenanceValue, setMaintenanceValue] = useState(false);
  const [msg, setMsg] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setStatusValue(closed ? "closed" : "open");
      setMaintenanceValue(maintenance);
      setMsg(message || DEFAULT_CLOSED_MESSAGE);
    }
  }, [open]);

  async function submit() {
    setSubmitting(true);
    try {
      const res = await api<{ closed: boolean; maintenance: boolean; message: string }>(
        "/api/admin/site-status",
        {
          method: "POST",
          body: {
            closed: statusValue === "closed",
            maintenance: maintenanceValue,
            message: msg.trim() || DEFAULT_CLOSED_MESSAGE,
          },
        }
      );
      onSaved(res.closed, res.maintenance, res.message);
      toast(
        res.closed
          ? "Order site closed for customers"
          : "Order site reopened for customers",
        "ok"
      );
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
      title="Order site status"
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
            {submitting ? "Saving…" : "Save status"}
          </button>
        </>
      }
    >
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Status</label>
        <select
          value={statusValue}
          onChange={(e) =>
            setStatusValue(e.target.value as "open" | "closed")
          }
        >
          <option value="open">Open for orders</option>
          <option value="closed">Closed for orders</option>
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Maintenance mode</label>
        <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input
            type="checkbox"
            checked={maintenanceValue}
            onChange={(e) => setMaintenanceValue(e.target.checked)}
          />
          Pause the public menu and new orders
        </label>
        <small style={{ display: "block", marginTop: 6 }}>
          The owner panel stays available. Existing customers can still track or cancel orders.
        </small>
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Quick presets</label>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {SITE_STATUS_PRESETS.map((p) => (
            <button
              key={p.label}
              className="btn btn-sm"
              type="button"
              onClick={() => setMsg(p.message)}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Message shown to customers</label>
        <textarea
          value={msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder="Orders are temporarily paused. Please check back soon."
        />
      </div>
      <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 16 }}>
        This message appears on the public order page whenever the site is
        closed.
      </div>
    </Modal>
  );
}
