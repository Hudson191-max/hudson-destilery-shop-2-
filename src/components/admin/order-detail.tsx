"use client";
// Order detail modal body + receipt/copy/print/image/slip actions.
import { useCallback } from "react";
import { Modal } from "@/components/modal";
import { toast } from "@/lib/toast";
import { CURRENCY, type InventoryRow } from "@/lib/types";
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
}

export function OrderDetailModal({
  open,
  order,
  inventory,
  onClose,
  onChangeStatus,
}: Props) {
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

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Order #${o.id} — ${o.customer}`}
      width="min(560px, 92vw)"
    >
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
