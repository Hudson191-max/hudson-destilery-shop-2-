"use client";
// New order modal: customer + contact + line items builder with live total
// and stock-shortage warnings. Fires confetti on success (via onConfetti).
import { useEffect, useMemo, useState } from "react";
import { Modal } from "@/components/modal";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { CURRENCY, orderTotal, type InventoryRow, type OrderLine } from "@/lib/types";
import { TOUCH_TARGET_ICON } from "../components/touch";

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
                  className={`btn btn-icon btn-sm btn-red ${TOUCH_TARGET_ICON}`}
                  onClick={() => removeLine(idx)}
                  aria-label={`Remove ${l.name}`}
                  title={`Remove ${l.name}`}
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
