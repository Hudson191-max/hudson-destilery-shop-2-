"use client";
// All admin modals except the order-detail one (lives in order-detail.tsx).
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  CURRENCY,
  INVENTORY_CATEGORIES,
  orderTotal,
  type InventoryRow,
  type OrderLine,
} from "@/lib/types";
import { SITE_STATUS_PRESETS, splitWhitelistInput } from "./admin-helpers";

const DEFAULT_CLOSED_MESSAGE =
  "Orders are temporarily paused. Please check back soon.";

// ─── New order modal ──────────────────────────────────────────────────────
interface NewOrderProps {
  open: boolean;
  inventory: InventoryRow[];
  onClose: () => void;
  onCreated: () => void;
  onConfetti: () => void;
}

export function NewOrderModal({
  open,
  inventory,
  onClose,
  onCreated,
  onConfetti,
}: NewOrderProps) {
  const [customer, setCustomer] = useState("");
  const [contact, setContact] = useState("");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<OrderLine[]>([]);
  const [itemId, setItemId] = useState<number | string | "">("");
  const [qty, setQty] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  // Reset form when opened, but preserve in-progress input during polling.
  useEffect(() => {
    if (open) {
      setCustomer("");
      setContact("");
      setNotes("");
      setLines([]);
      setQty(1);
      setItemId(inventory[0]?.id ?? "");
    }
  }, [open]);

  const total = useMemo(() => orderTotal(lines), [lines]);

  function addLine() {
    if (itemId === "" || !Number.isFinite(itemId)) return;
    const item = inventory.find((i) => i.id === itemId);
    if (!item) return;
    const q = Math.max(1, Number(qty) || 1);
    setLines((prev) => {
      const ex = prev.find((l) => l.itemId === item.id);
      if (ex) {
        return prev.map((l) =>
          l.itemId === item.id ? { ...l, qty: l.qty + q } : l
        );
      }
      return [
        ...prev,
        { itemId: item.id, name: item.name, qty: q, price: item.price },
      ];
    });
  }

  function removeLine(idx: number) {
    setLines((prev) => prev.filter((_, i) => i !== idx));
  }

  async function submit() {
    if (!customer.trim()) {
      toast("Enter customer name", "err");
      return;
    }
    if (!lines.length) {
      toast("Add at least one item", "err");
      return;
    }
    setSubmitting(true);
    try {
      const res = await api<{ id: number }>("/api/admin/order", {
        method: "POST",
        body: {
          customer: customer.trim(),
          contact: contact.trim(),
          notes: notes.trim(),
          lines,
        },
      });
      onConfetti();
      toast(`Order #${res.id} created`, "ok");
      onCreated();
      onClose();
    } catch (e) {
      const err = e as ApiError;
      toast("Order creation failed", "err", err.detail || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New order"
      footer={
        <>
          <span
            style={{
              fontFamily: "var(--font-head)",
              fontSize: 18,
              color: "var(--accent)",
              alignSelf: "center",
              marginRight: "auto",
            }}
          >
            Total: <span>{total.toLocaleString()}</span> {CURRENCY}
          </span>
          <button className="btn" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-accent"
            onClick={() => void submit()}
            disabled={submitting}
          >
            {submitting ? "Creating…" : "Create order"}
          </button>
        </>
      }
    >
      <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
        <div className="form-group">
          <label>Customer name</label>
          <input
            value={customer}
            onChange={(e) => setCustomer(e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="form-group">
          <label>Discord / contact</label>
          <input
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            maxLength={120}
          />
        </div>
      </div>
      <div className="form-group" style={{ marginBottom: 12 }}>
        <label>Add items</label>
        <div style={{ display: "flex", gap: 6 }}>
          <select
            style={{ flex: 1 }}
            value={itemId}
            onChange={(e) =>
              setItemId(e.target.value === "" ? "" : Number(e.target.value))
            }
          >
            {inventory.length === 0 ? (
              <option value="">No items in inventory</option>
            ) : (
              inventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {i.price.toLocaleString()} {CURRENCY} ({i.stock}{" "}
                  in stock)
                </option>
              ))
            )}
          </select>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value) || 1)}
            style={{ width: 64 }}
          />
          <button className="btn btn-sm btn-green" onClick={addLine}>
            Add
          </button>
        </div>
      </div>
      <div className="order-lines" style={{ marginBottom: 12 }}>
        {lines.length === 0 ? (
          <div className="empty">No items added</div>
        ) : (
          lines.map((l, idx) => {
            const item = inventory.find((i) => i.id === l.itemId);
            const inStock = item ? item.stock : 0;
            const shortage = Math.max(0, l.qty - inStock);
            return (
              <div className="order-line" key={idx}>
                <span className="order-line-name">{l.name}</span>
                {shortage > 0 ? (
                  <span
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: 10,
                      background: "rgba(224,92,92,.15)",
                      color: "var(--red)",
                      border: "1px solid rgba(224,92,92,.3)",
                      borderRadius: 2,
                      padding: "1px 6px",
                    }}
                  >
                    need {shortage} more
                  </span>
                ) : null}
                <span style={{ color: "var(--text2)", fontSize: 12 }}>
                  ×{l.qty}
                </span>
                <span className="order-line-price">
                  {(l.qty * l.price).toLocaleString()} {CURRENCY}
                </span>
                <button
                  className="btn btn-icon btn-sm btn-red"
                  onClick={() => removeLine(idx)}
                >
                  ✕
                </button>
              </div>
            );
          })
        )}
        {lines.some((l) => {
          const item = inventory.find((i) => i.id === l.itemId);
          return l.qty - (item ? item.stock : 0) > 0;
        }) ? (
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--yellow)",
              padding: "6px 0 2px",
            }}
          >
            ⚠ Some items short — order will still be created
          </div>
        ) : null}
      </div>
      <div className="form-group" style={{ marginBottom: 4 }}>
        <label>Notes</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={2000}
        />
      </div>
    </Modal>
  );
}

// ─── Add item modal (owner) ───────────────────────────────────────────────
interface AddItemProps {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}

export function AddItemModal({ open, onClose, onDone }: AddItemProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [stock, setStock] = useState<number | "">("");
  const [cat, setCat] = useState<string>("Other");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setName("");
      setPrice("");
      setStock("");
      setCat("Other");
    }
  }, [open]);

  async function submit() {
    if (!name.trim()) {
      toast("Enter item name", "err");
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/admin/inventory", {
        method: "POST",
        body: {
          name: name.trim(),
          price: Number(price) || 0,
          stock: Number(stock) || 0,
          cat,
        },
      });
      toast(`${name.trim()} added to inventory`, "ok");
      onDone();
      onClose();
    } catch (e) {
      const err = e as ApiError;
      toast("Add item failed", "err", err.detail || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add inventory item"
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
            {submitting ? "Adding…" : "Add item"}
          </button>
        </>
      }
    >
      <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
        <div className="form-group">
          <label>Item name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="form-group">
          <label>Price ({CURRENCY})</label>
          <input
            type="number"
            min={0}
            value={price}
            onChange={(e) =>
              setPrice(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </div>
      </div>
      <div className="form-grid form-grid-2">
        <div className="form-group">
          <label>Starting stock</label>
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(e) =>
              setStock(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            {INVENTORY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
    </Modal>
  );
}

// ─── Edit item modal (owner) ──────────────────────────────────────────────
interface EditItemProps {
  open: boolean;
  item: InventoryRow | null;
  onClose: () => void;
  onDone: () => void;
}

export function EditItemModal({ open, item, onClose, onDone }: EditItemProps) {
  const [name, setName] = useState("");
  const [price, setPrice] = useState<number | "">("");
  const [stock, setStock] = useState<number | "">("");
  const [cat, setCat] = useState<string>("Other");
  // Default to "for sale" when an older item has no `active` value yet.
  const [active, setActive] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open && item) {
      setName(item.name);
      setPrice(item.price);
      setStock(item.stock);
      setCat(item.cat);
      setActive(item.active !== false);
    }
  }, [open, item?.id]);

  async function submit() {
    if (!item) return;
    setSubmitting(true);
    try {
      await api("/api/admin/inventory", {
        method: "PATCH",
        body: {
          id: item.id,
          name: name.trim() || item.name,
          price: Number(price) || item.price,
          stock: Math.max(0, Number(stock) || 0),
          cat,
          active,
        },
      });
      toast(`${name.trim() || item.name} inventory item updated`, "ok");
      onDone();
      onClose();
    } catch (e) {
      const err = e as ApiError;
      toast("Edit failed", "err", err.detail || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit item"
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
            {submitting ? "Saving…" : "Save changes"}
          </button>
        </>
      }
    >
      <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
        <div className="form-group">
          <label>Item name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
          />
        </div>
        <div className="form-group">
          <label>Price ({CURRENCY})</label>
          <input
            type="number"
            value={price}
            onChange={(e) =>
              setPrice(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </div>
      </div>
      <div className="form-grid form-grid-2">
        <div className="form-group">
          <label>Stock</label>
          <input
            type="number"
            min={0}
            value={stock}
            onChange={(e) =>
              setStock(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </div>
        <div className="form-group">
          <label>Category</label>
          <select value={cat} onChange={(e) => setCat(e.target.value)}>
            {INVENTORY_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="form-group" style={{ marginTop: 12 }}>
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            cursor: "pointer",
            userSelect: "none",
          }}
        >
          <input
            type="checkbox"
            checked={active}
            onChange={(e) => setActive(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer" }}
          />
          <span>
            Available for sale
            <span
              style={{
                display: "block",
                color: "var(--text2)",
                fontSize: 12,
                marginTop: 2,
              }}
            >
              When off, this item is hidden from the public order page and
              cannot be ordered.
            </span>
          </span>
        </label>
      </div>
    </Modal>
  );
}

// ─── Restock modal ────────────────────────────────────────────────────────
interface RestockProps {
  open: boolean;
  inventory: InventoryRow[];
  presetItemId: number | string | null;
  onClose: () => void;
  onDone: () => void;
}

export function RestockModal({
  open,
  inventory,
  presetItemId,
  onClose,
  onDone,
}: RestockProps) {
  const [itemId, setItemId] = useState<number | string | "">("");
  const [qty, setQty] = useState<number | "">("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setQty("");
      setNote("");
      if (presetItemId != null) {
        setItemId(presetItemId);
      } else {
        setItemId(inventory[0]?.id ?? "");
      }
    }
  }, [open, presetItemId]);

  async function submit() {
    if (itemId === "" || !Number.isFinite(itemId)) {
      toast("Select an item", "err");
      return;
    }
    if (!qty || Number(qty) <= 0) {
      toast("Enter a valid quantity", "err");
      return;
    }
    setSubmitting(true);
    try {
      await api("/api/admin/inventory/restock", {
        method: "POST",
        body: { id: itemId, qty: Number(qty), note: note.trim() },
      });
      const item = inventory.find((i) => i.id === itemId);
      toast(
        `${Number(qty)} units restocked for ${item ? item.name : "item"}`,
        "ok"
      );
      onDone();
      onClose();
    } catch (e) {
      const err = e as ApiError;
      toast("Restock failed", "err", err.detail || err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Log restock"
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
            {submitting ? "Logging…" : "Log restock"}
          </button>
        </>
      }
    >
      <div className="form-grid form-grid-2" style={{ marginBottom: 12 }}>
        <div className="form-group">
          <label>Item</label>
          <select
            value={itemId}
            onChange={(e) =>
              setItemId(e.target.value === "" ? "" : Number(e.target.value))
            }
            style={{ width: "100%" }}
          >
            {inventory.length === 0 ? (
              <option value="">No items</option>
            ) : (
              inventory.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} — {i.stock} in stock
                </option>
              ))
            )}
          </select>
        </div>
        <div className="form-group">
          <label>Quantity added</label>
          <input
            type="number"
            min={1}
            value={qty}
            onChange={(e) =>
              setQty(e.target.value === "" ? "" : Number(e.target.value))
            }
          />
        </div>
      </div>
      <div className="form-group">
        <label>Note (optional)</label>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={200}
        />
      </div>
    </Modal>
  );
}

// ─── Site status modal (owner) ────────────────────────────────────────────
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

// ─── Discord modal (owner) ────────────────────────────────────────────────
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

// ─── Whitelist modal (owner) ──────────────────────────────────────────────
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
