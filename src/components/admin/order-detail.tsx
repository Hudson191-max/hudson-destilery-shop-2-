"use client";
// Order detail modal body + receipt/copy/print/image/slip actions + edit mode.
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { Modal } from "@/components/modal";
import { toast } from "@/lib/toast";
import { CURRENCY, type InventoryRow, type OrderLine } from "@/lib/types";
import {
  buildOrderDiscordText,
  buildOrderReceiptMarkup,
  buildOrderSlipText,
  statusBadgeClass,
  type AdminOrder,
} from "./admin-helpers";

// Lazily import html2canvas so a failure doesn't break the bundle.
let html2canvasModule: typeof import("html2canvas") | null = null;
async function getHtml2Canvas() {
  if (html2canvasModule !== null) return html2canvasModule;
  try {
    html2canvasModule = await import("html2canvas");
    return html2canvasModule;
  } catch {
    html2canvasModule = null;
    return null;
  }
}

interface Props {
  open: boolean;
  order: AdminOrder | null;
  inventory: InventoryRow[];
  onClose: () => void;
  onChangeStatus: (id: number | string, status: string) => Promise<void>;
  onEdited?: () => void;
}

export function OrderDetailModal({
  open,
  order,
  inventory,
  onClose,
  onChangeStatus,
  onEdited,
}: Props) {
  // ── Edit mode state ──────────────────────────────────────────────────────
  const [editing, setEditing] = useState(false);
  const [editCustomer, setEditCustomer] = useState("");
  const [editContact, setEditContact] = useState("");
  const [editSteam, setEditSteam] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLines, setEditLines] = useState<
    Record<string, number>
  >({});
  const [editSaving, setEditSaving] = useState(false);

  // Sync edit fields when modal opens or order changes.
  useEffect(() => {
    if (open && order) {
      setEditing(false);
      setEditCustomer(order.customer || "");
      setEditContact(order.contact || "");
      setEditSteam(order.steam || "");
      setEditNotes(order.notes || "");
      const m: Record<string, number> = {};
      for (const l of order.parsedLines) {
        m[String(l.itemId)] = l.qty;
      }
      setEditLines(m);
    }
  }, [open, order?.id]);

  async function handleSaveEdit() {
    if (!order) return;
    if (!editCustomer.trim()) {
      toast("Customer name required.", "err");
      return;
    }
    const items = Object.entries(editLines)
      .filter(([, qty]) => qty > 0)
      .map(([itemId, qty]) => ({ itemId, qty }));
    if (items.length === 0) {
      toast("Add at least one item.", "err");
      return;
    }
    setEditSaving(true);
    try {
      await api("/api/admin/order/edit", {
        method: "POST",
        body: {
          id: order.id,
          customer: editCustomer.trim(),
          contact: editContact.trim(),
          steam: editSteam.trim(),
          notes: editNotes.trim(),
          lines: items,
        },
      });
      toast(`Order #${order.id} updated.`, "ok");
      setEditing(false);
      if (onEdited) onEdited();
    } catch (e) {
      const err = e as ApiError;
      toast("Edit failed", "err", err.detail || err.message);
    } finally {
      setEditSaving(false);
    }
  }

  const handleCopyDiscord = useCallback(async () => {
    if (!order) return;
    const text = buildOrderDiscordText({
      id: order.id,
      customer: order.customer,
      contact: order.contact,
      steam: order.steam,
      status: String(order.status || "Preparing"),
      date: order.date,
      notes: order.notes,
      parsedLines: order.parsedLines,
      total: order.total,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast("Order details copied for Discord.", "ok");
    } catch {
      toast("Copy failed. Please copy manually.", "err");
    }
  }, [order]);

  const handleCopySlip = useCallback(async () => {
    if (!order) return;
    const text = buildOrderSlipText({
      id: order.id,
      customer: order.customer,
      contact: order.contact,
      steam: order.steam,
      status: String(order.status || "Preparing"),
      date: order.date,
      notes: order.notes,
      parsedLines: order.parsedLines,
      total: order.total,
    });
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard!", "ok");
    } catch {
      toast("Copy failed", "err");
    }
  }, [order]);

  const handlePrintReceipt = useCallback(() => {
    if (!order) return;
    const printWindow = window.open("", "_blank", "width=900,height=700");
    if (!printWindow) {
      toast("Please allow popups to print the receipt.", "err");
      return;
    }
    const markup = buildOrderReceiptMarkup({
      id: order.id,
      customer: order.customer,
      status: String(order.status || "Preparing"),
      date: order.date,
      contact: order.contact,
      parsedLines: order.parsedLines,
      total: order.total,
    });
    printWindow.document.write(
      `<html><head><title>Order #${order.id} receipt</title><style>body{margin:0;padding:0;background:#fff;color:#000}*{box-sizing:border-box}</style></head><body>${markup}</body></html>`
    );
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => printWindow.print(), 250);
  }, [order]);

  const handleCopyReceiptImage = useCallback(async () => {
    if (!order) return;
    const html2canvas = await getHtml2Canvas();
    if (!html2canvas || typeof html2canvas.default !== "function") {
      toast("Image capture unavailable", "err");
      return;
    }
    const wrapper = document.createElement("div");
    wrapper.style.position = "fixed";
    wrapper.style.left = "-9999px";
    wrapper.style.top = "0";
    wrapper.style.width = "720px";
    wrapper.style.background = "#fff";
    wrapper.style.zIndex = "-1";
    wrapper.innerHTML = buildOrderReceiptMarkup({
      id: order.id,
      customer: order.customer,
      status: String(order.status || "Preparing"),
      date: order.date,
      contact: order.contact,
      parsedLines: order.parsedLines,
      total: order.total,
    });
    document.body.appendChild(wrapper);
    try {
      const canvas = await (html2canvas as unknown as { default: (el: HTMLElement, opts: Record<string, unknown>) => Promise<HTMLCanvasElement> }).default(
        wrapper,
        {
          backgroundColor: "#ffffff",
          scale: 2,
          useCORS: true,
          allowTaint: false,
        }
      );
      const blob: Blob | null = await new Promise((resolve) =>
        canvas.toBlob((b) => resolve(b), "image/png")
      );
      if (!blob) {
        toast("Could not create image from receipt.", "err");
        return;
      }
      const filename = `order-${order.id}-receipt.png`;
      const w = navigator.clipboard as Clipboard & {
        write?: (items: ClipboardItem[]) => Promise<void>;
      };
      if (w && typeof w.write === "function" && typeof ClipboardItem !== "undefined") {
        try {
          const item = new ClipboardItem({ [blob.type]: blob });
          await w.write([item]);
          toast("Receipt copied as image. You can paste it now.", "ok");
        } catch {
          const link = document.createElement("a");
          link.href = canvas.toDataURL("image/png");
          link.download = filename;
          link.click();
          toast("Clipboard copy failed, image downloaded instead.", "err");
        }
      } else {
        const link = document.createElement("a");
        link.href = canvas.toDataURL("image/png");
        link.download = filename;
        link.click();
        toast("Clipboard not supported, image downloaded instead.", "err");
      }
    } catch {
      toast("Could not capture receipt image.", "err");
    } finally {
      wrapper.remove();
    }
  }, [order]);

  if (!order) return null;

  const o = order;
  const lines = o.parsedLines;
  const hasShortage = lines.some((l) => {
    const item = inventory.find((i) => i.id === l.itemId);
    return Math.max(0, l.qty - (item ? item.stock : 0)) > 0;
  });

  const status = String(o.status || "Preparing");
  const canCancel = status !== "Done" && status !== "Cancelled";
  const canDeliver =
    status !== "Done" &&
    status !== "Cancelled" &&
    status !== "Ready for Delivery";
  const canEdit = canCancel;

  const editTotal = Object.entries(editLines)
    .filter(([, qty]) => qty > 0)
    .reduce((sum, [itemId, qty]) => {
      const item = inventory.find((i) => String(i.id) === itemId);
      return sum + (item ? item.price * qty : 0);
    }, 0);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? `Edit Order #${o.id}` : `Order #${o.id} — ${o.customer}`}
      width="min(560px, 92vw)"
    >
      {editing ? (
        <div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <div className="form-group">
              <label>Customer *</label>
              <input
                value={editCustomer}
                onChange={(e) => setEditCustomer(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Contact</label>
              <input
                value={editContact}
                onChange={(e) => setEditContact(e.target.value)}
                placeholder="Discord / phone"
              />
            </div>
            <div className="form-group">
              <label>Steam ID</label>
              <input
                value={editSteam}
                onChange={(e) => setEditSteam(e.target.value)}
                className="td-mono"
                style={{ fontSize: 12 }}
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <span className={statusBadgeClass(status)}>{status}</span>
              <div style={{ fontSize: 11, color: "var(--text2)", marginTop: 4 }}>
                Status can't be edited here — use the action buttons after saving.
              </div>
            </div>
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>Notes</label>
            <textarea
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text2)",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            ITEMS (set qty to 0 to remove)
          </div>
          <div className="order-lines" style={{ marginBottom: 8 }}>
            {inventory.map((item) => {
              const qty = editLines[String(item.id)] || 0;
              const selected = qty > 0;
              return (
                <div
                  className="order-line"
                  key={item.id}
                  style={{
                    opacity: selected ? 1 : 0.5,
                    cursor: "pointer",
                  }}
                  onClick={() =>
                    setEditLines((m) => ({
                      ...m,
                      [String(item.id)]: selected ? 0 : 1,
                    }))
                  }
                >
                  <span className="order-line-name">{item.name}</span>
                  <span style={{ color: "var(--text2)", fontSize: 12 }}>
                    {item.price.toLocaleString()} {CURRENCY}
                  </span>
                  {selected ? (
                    <span
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() =>
                          setEditLines((m) => ({
                            ...m,
                            [String(item.id)]: Math.max(0, qty - 1),
                          }))
                        }
                      >
                        −
                      </button>
                      <input
                        type="number"
                        value={qty}
                        onChange={(e) =>
                          setEditLines((m) => ({
                            ...m,
                            [String(item.id)]: Math.max(
                              0,
                              Number(e.target.value) || 0
                            ),
                          }))
                        }
                        style={{ width: 48, textAlign: "center" }}
                      />
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() =>
                          setEditLines((m) => ({
                            ...m,
                            [String(item.id)]: qty + 1,
                          }))
                        }
                      >
                        +
                      </button>
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text2)" }}>
                      click to add
                    </span>
                  )}
                </div>
              );
            })}
            <div
              className="order-line"
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              <span
                className="order-line-name"
                style={{ fontWeight: 600, color: "var(--text0)" }}
              >
                New Total
              </span>
              <span
                className="order-line-price"
                style={{
                  fontSize: 15,
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                {editTotal.toLocaleString()} {CURRENCY}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              className="btn btn-accent"
              onClick={() => void handleSaveEdit()}
              disabled={editSaving}
            >
              {editSaving ? "Saving…" : "✓ Save changes"}
            </button>
            <button
              className="btn"
              onClick={() => setEditing(false)}
              disabled={editSaving}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 12,
              marginBottom: 16,
            }}
          >
            <Field label="CUSTOMER">
              <span style={{ fontWeight: 600, color: "var(--text0)" }}>
                {o.customer}
              </span>
            </Field>
            <Field label="CONTACT">
              <span>{o.contact || "—"}</span>
            </Field>
            <Field label="STEAM ID">
              <span className="td-mono" style={{ fontSize: 12 }}>
                {o.steam || "—"}
              </span>
            </Field>
            <Field label="STATUS">
              <span className={statusBadgeClass(status)}>{status}</span>
            </Field>
            <Field label="DATE">
              <span>{o.date || "—"}</span>
            </Field>
          </div>

          {o.notes ? (
            <div
              style={{
                background: "rgba(200,168,75,.07)",
                border: "1px solid rgba(200,168,75,.2)",
                borderRadius: 4,
                padding: "10px 14px",
                marginBottom: 16,
                fontSize: 13,
                color: "var(--text1)",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  color: "var(--accent)",
                  letterSpacing: 1,
                  display: "block",
                  marginBottom: 4,
                }}
              >
                📝 NOTES
              </span>
              {o.notes}
            </div>
          ) : null}

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text2)",
              letterSpacing: 1,
              marginBottom: 8,
            }}
          >
            ITEMS
          </div>
          <div
            className="order-lines"
            style={{ marginBottom: hasShortage ? 8 : 16 }}
          >
            {lines.map((l, idx) => {
              const item = inventory.find((i) => i.id === l.itemId);
              const inStock = item ? item.stock : 0;
              const shortage = Math.max(0, l.qty - inStock);
              return (
                <div className="order-line" key={idx}>
                  <span className="order-line-name">{l.name}</span>
                  {shortage > 0 ? (
                    <ShortageTag shortage={shortage} />
                  ) : (
                    <InStockTag />
                  )}
                  <span style={{ color: "var(--text2)", fontSize: 12 }}>
                    ×{l.qty}
                  </span>
                  <span className="order-line-price">
                    {(l.qty * l.price).toLocaleString()} {CURRENCY}
                  </span>
                </div>
              );
            })}
            <div
              className="order-line"
              style={{
                borderTop: "1px solid var(--border)",
                paddingTop: 8,
                marginTop: 4,
              }}
            >
              <span
                className="order-line-name"
                style={{ fontWeight: 600, color: "var(--text0)" }}
              >
                Total
              </span>
              <span
                className="order-line-price"
                style={{
                  fontSize: 15,
                  color: "var(--accent)",
                  fontWeight: 600,
                }}
              >
                {o.total.toLocaleString()} {CURRENCY}
              </span>
            </div>
          </div>

          {hasShortage ? (
            <div
              style={{
                background: "rgba(224,92,92,.08)",
                border: "1px solid rgba(224,92,92,.25)",
                borderRadius: 4,
                padding: "10px 14px",
                marginBottom: 16,
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                color: "var(--red)",
              }}
            >
              ⚠ This order has items not fully in stock
            </div>
          ) : null}

          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {canDeliver ? (
              <button
                className="btn btn-accent"
                onClick={() => {
                  void onChangeStatus(o.id, "Ready for Delivery");
                }}
              >
                🚚 Push to delivery
              </button>
            ) : null}
            {status === "Ready for Delivery" ? (
              <button
                className="btn btn-accent"
                onClick={() => {
                  void onChangeStatus(o.id, "Done");
                }}
              >
                ✓ Mark delivered
              </button>
            ) : null}
            {canCancel ? (
              <button
                className="btn btn-red"
                onClick={() => {
                  void onChangeStatus(o.id, "Cancelled");
                }}
              >
                ✕ Cancel
              </button>
            ) : null}
            {canEdit ? (
              <button
                className="btn"
                onClick={() => setEditing(true)}
                title="Edit order details"
              >
                ✏ Edit
              </button>
            ) : null}
            <button className="btn" onClick={handleCopyDiscord}>
              📋 Copy for Discord
            </button>
            <button className="btn" onClick={handleCopyReceiptImage}>
              📷 Copy image
            </button>
            <button className="btn" onClick={handlePrintReceipt}>
              🖨 Print receipt
            </button>
            <button className="btn" onClick={handleCopySlip}>
              🖨️ Copy slip
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text2)",
          letterSpacing: 1,
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div>{children}</div>
    </div>
  );
}

function ShortageTag({ shortage }: { shortage: number }) {
  return (
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
  );
}

function InStockTag() {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 10,
        background: "rgba(76,175,125,.1)",
        color: "var(--green)",
        border: "1px solid rgba(76,175,125,.3)",
        borderRadius: 2,
        padding: "1px 6px",
      }}
    >
      ✓ in stock
    </span>
  );
}
