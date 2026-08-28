"use client";
// Edit inventory item modal (owner): name/price/stock/category plus the
// "available for sale" switch that hides an item from the public order page.
import { useEffect, useState } from "react";
import { Modal } from "@/components/modal";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import { CURRENCY, INVENTORY_CATEGORIES, type InventoryRow } from "@/lib/types";

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
