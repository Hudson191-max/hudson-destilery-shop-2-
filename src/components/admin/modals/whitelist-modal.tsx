"use client";
// Access whitelist modal (owner): comma/newline separated employee + owner
// names used by the login flow. Loads the current lists when opened.
import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { splitWhitelistInput } from "../admin-helpers";

interface WhitelistProps {
  open: boolean;
  onClose: () => void;
}

export function WhitelistModal({ open, onClose }: WhitelistProps) {
  const [employee, setEmployee] = useState("");
  const [owner, setOwner] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const res = await api<{ employee: string[]; owner: string[] }>(
          "/api/admin/whitelist"
        );
        if (cancelled) return;
        setEmployee((res.employee || []).join(", "));
        setOwner((res.owner || []).join(", "));
      } catch (e) {
        const err = e as ApiError;
        toast("Failed to load whitelist", "err", err.detail || err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  async function submit() {
    setSubmitting(true);
    try {
      const employeeNames = splitWhitelistInput(employee);
      const ownerNames = splitWhitelistInput(owner);
      await api("/api/admin/whitelist", {
        method: "POST",
        body: { employee: employeeNames, owner: ownerNames },
      });
      toast("Access whitelist updated", "ok");
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
      title="Access whitelist"
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-accent"
            onClick={() => void submit()}
            disabled={submitting || loading}
          >
            {submitting ? "Saving…" : "Save whitelist"}
          </button>
        </>
      }
    >
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Employee names</label>
        <textarea
          rows={4}
          value={employee}
          onChange={(e) => setEmployee(e.target.value)}
          placeholder="hudson, maria, sam"
          disabled={loading}
        />
      </div>
      <div className="form-group" style={{ marginBottom: 16 }}>
        <label>Owner names</label>
        <textarea
          rows={4}
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="hudson, owner"
          disabled={loading}
        />
      </div>
      <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 16 }}>
        Separate names with commas or new lines. These names are saved to the
        database and will be used on the next login.
      </div>
    </Modal>
  );
}
