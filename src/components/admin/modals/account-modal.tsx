"use client";
// Manage accounts modal (owner): list accounts, create new ones with a
// generated temporary password, reset or delete existing accounts.
import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";

interface AccountModalProps {
  open: boolean;
  onClose: () => void;
}

type Account = { username: string; role: "employee" | "owner" };

export function AccountModal({ open, onClose }: AccountModalProps) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<Account["role"]>("employee");
  const [password, setPassword] = useState("");
  const [revealedPassword, setRevealedPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function loadAccounts() {
    setLoading(true);
    try {
      const res = await api<{ accounts: Account[] }>("/api/admin/accounts");
      setAccounts(res.accounts || []);
    } catch (e) {
      const err = e as ApiError;
      toast("Failed to load accounts", "err", err.detail || err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void loadAccounts();
  }, [open]);

  async function createAccount() {
    setSubmitting(true);
    try {
      await api("/api/admin/accounts", {
        method: "POST",
        body: { username, role, password },
      });
      setUsername("");
      setPassword("");
      setRevealedPassword(password);
      toast("Account created", "ok");
      await loadAccounts();
    } catch (e) {
      const err = e as ApiError;
      toast("Could not create account", "err", err.detail || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function generatePassword(): string {
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
    const values = new Uint32Array(16);
    crypto.getRandomValues(values);
    return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
  }

  function useGeneratedPassword() {
    const next = generatePassword();
    setPassword(next);
    setRevealedPassword(next);
  }

  async function resetPassword(account: Account) {
    const next = generatePassword();
    try {
      await api("/api/admin/accounts", {
        method: "PATCH",
        body: { username: account.username, password: next },
      });
      setRevealedPassword(next);
      toast(`New password created for ${account.username}`, "ok");
    } catch (e) {
      const err = e as ApiError;
      toast("Could not reset password", "err", err.detail || err.message);
    }
  }

  async function copyPassword() {
    if (!revealedPassword) return;
    await navigator.clipboard.writeText(revealedPassword);
    toast("Password copied", "ok");
  }

  async function deleteAccount(account: Account) {
    if (!window.confirm(`Delete ${account.username}?`)) return;
    try {
      await api("/api/admin/accounts", {
        method: "DELETE",
        body: { username: account.username },
      });
      toast("Account deleted", "ok");
      await loadAccounts();
    } catch (e) {
      const err = e as ApiError;
      toast("Could not delete account", "err", err.detail || err.message);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Manage accounts"
      footer={<button className="btn" onClick={onClose}>Close</button>}
    >
      <div style={{ marginBottom: 18 }}>
        <strong>Current accounts</strong>
        {loading ? <div style={{ marginTop: 8 }}>Loading…</div> : accounts.map((account) => (
          <div key={account.username} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginTop: 8 }}>
            <span>{account.username} <small>({account.role})</small></span>
            <span style={{ display: "flex", gap: 6 }}>
              <button className="btn btn-sm" onClick={() => void resetPassword(account)}>New password</button>
              <button className="btn btn-sm btn-red" onClick={() => void deleteAccount(account)}>Delete</button>
            </span>
          </div>
        ))}
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>New username</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="off" />
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Role</label>
        <select value={role} onChange={(e) => setRole(e.target.value as Account["role"])}>
          <option value="employee">Employee</option>
          <option value="owner">Owner</option>
        </select>
      </div>
      <div className="form-group" style={{ marginBottom: 8 }}>
        <label>Temporary password</label>
        <div style={{ display: "flex", gap: 8 }}>
          <input type="text" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
          <button className="btn btn-sm" type="button" onClick={useGeneratedPassword}>Generate</button>
        </div>
      </div>
      <button className="btn btn-accent" onClick={() => void createAccount()} disabled={submitting || !username || password.length < 8}>
        {submitting ? "Creating…" : "Create account"}
      </button>
      <div style={{ fontSize: 12, color: "var(--text2)", marginTop: 8 }}>
        Passwords must be at least 8 characters. Share temporary passwords securely.
      </div>
      {revealedPassword ? (
        <div style={{ marginTop: 14, padding: 10, border: "1px solid var(--border)", borderRadius: 6 }}>
          <div style={{ fontSize: 12, color: "var(--text2)", marginBottom: 6 }}>Password to send</div>
          <div style={{ display: "flex", gap: 8 }}>
            <input value={revealedPassword} readOnly aria-label="Generated password" />
            <button className="btn btn-sm" type="button" onClick={() => void copyPassword()}>Copy</button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
