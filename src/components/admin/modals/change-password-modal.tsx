"use client";
// Self-service "Change password" modal — available to every signed-in staff
// member (owner and employee). Requires the CURRENT password, validates the
// new one locally, then POSTs to /api/auth/change-password (which re-verifies
// and re-hashes with scrypt server-side).
import { useState } from "react";
import { Eye, EyeOff, KeyRound } from "lucide-react";
import { Modal } from "@/components/modal";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { FOCUS_RING } from "../components/touch";

interface ChangePasswordModalProps {
  open: boolean;
  onClose: () => void;
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="form-group" style={{ marginBottom: 12 }}>
      <label htmlFor={id}>{label}</label>
      <div style={{ display: "flex", gap: 8 }}>
        <input
          id={id}
          type={show ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className={FOCUS_RING}
        />
        <button
          type="button"
          className={`btn btn-sm ${FOCUS_RING}`}
          onClick={() => setShow((s) => !s)}
          aria-label={show ? `Hide ${label}` : `Show ${label}`}
          title={show ? "Hide password" : "Show password"}
        >
          {show ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}

export function ChangePasswordModal({ open, onClose }: ChangePasswordModalProps) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
  }

  async function submit() {
    if (!current) {
      toast("Enter your current password", "err");
      return;
    }
    if (next.length < 8) {
      toast("New password must be at least 8 characters.", "err");
      return;
    }
    if (next !== confirm) {
      toast("New passwords do not match.", "err");
      return;
    }
    if (next === current) {
      toast("Choose a password different from the current one.", "err");
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/auth/change-password", {
        method: "POST",
        body: { current, next },
      });
      toast("Password updated", "ok", "Use it on your next sign-in.");
      reset();
      onClose();
    } catch (e) {
      const err = e as ApiError;
      toast("Could not change password", "err", err.detail || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Change your password"
      footer={
        <div style={{ display: "flex", gap: 8 }}>
          <button
            className={`btn ${FOCUS_RING}`}
            onClick={() => {
              reset();
              onClose();
            }}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            className="btn btn-accent"
            onClick={() => void submit()}
            disabled={submitting || !current || !next || !confirm}
          >
            {submitting ? "Updating…" : "Update password"}
          </button>
        </div>
      }
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 12,
          color: "var(--text2)",
          marginBottom: 14,
        }}
      >
        <KeyRound size={14} aria-hidden="true" style={{ color: "var(--accent)" }} />
        You stay signed in — only your credential changes.
      </div>
      <PasswordField
        id="pw-current"
        label="Current password"
        value={current}
        onChange={setCurrent}
        autoComplete="current-password"
      />
      <PasswordField
        id="pw-new"
        label="New password (min 8 characters)"
        value={next}
        onChange={setNext}
        autoComplete="new-password"
      />
      <PasswordField
        id="pw-confirm"
        label="Repeat new password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
      />
      <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 4 }}>
        Passwords are stored as scrypt hashes — nobody (including owners) can
        read them.
      </div>
    </Modal>
  );
}
