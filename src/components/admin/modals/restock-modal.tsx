"use client";
// Log restock modal: pick an item, quantity added, optional note.
// presetItemId pre-selects an item when opened from a table row's "+" button.
import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import type { InventoryRow } from "@/lib/types";

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
