"use client";
// Add inventory item modal (owner).
import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { CURRENCY, INVENTORY_CATEGORIES } from "@/lib/types";

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
