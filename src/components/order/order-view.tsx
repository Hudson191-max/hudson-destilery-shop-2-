"use client";

import { useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api-client";
import { toast } from "@/lib/toast";
import {
  CURRENCY,
  LOGO_URL,
  MAX_ITEMS_PER_ORDER,
  MAX_ORDER_TOTAL,
  type OrderLine,
  type PublicOrder,
} from "@/lib/types";

/* ── Types ─────────────────────────────────────────────────────────── */

type InventoryItem = { id: number | string; name: string; price: number };

interface SiteStatus {
  closed: boolean;
  message: string;
  discordLink: string;
}

interface SuccessData {
  id: number;
  cancelCode: string;
  status: string;
  customer: string;
  lines: OrderLine[];
  total: number;
  date: string;
}

type TrackResult =
  | { kind: "order"; order: PublicOrder }
  | { kind: "notfound"; id: number | string }
  | { kind: "empty" };

/* ── Constants ─────────────────────────────────────────────────────── */

const TOS_BULLETS = [
  "Orders are accepted subject to stock availability and confirmation by The Hudson Distillery.",
  "Prices are final at the time of placement unless otherwise stated.",
  "You must provide accurate contact details so we can process and track your order.",
  "We may cancel or hold an order if details are unclear, incomplete, or if the order cannot be fulfilled.",
  "Customers may request cancellation before the order is prepared, subject to our current policy.",
  "The Hudson Distillery is not responsible for any data leaks, breaches, or unauthorized access to information submitted through this form. By placing an order you acknowledge that you are submitting your details at your own risk.",
  "We recommend not sharing sensitive personal information beyond what is required to complete your order.",
  "This service is not affiliated with, endorsed by, or connected to Unturned™ or URP.",
];

const CANCELLABLE_STATUSES = [
  "Preparing",
  "Pending",
  "Waiting on Payment",
  "Active",
];

const TIMELINE_STEPS = [
  { title: "Order placed", sub: "Your order has been received and logged." },
  { title: "Preparing", sub: "We are gathering your items and getting it ready." },
  { title: "Ready for pickup", sub: "Your order is ready to be collected or delivered." },
  { title: "Completed", sub: "The order has been finished." },
];

type DotState = "active" | "inactive" | "cancelled";

/* ── Helpers ───────────────────────────────────────────────────────── */

function statusBadgeClass(status: string): string {
  switch (status) {
    case "Preparing":
      return "badge-preparing";
    case "Waiting on Payment":
      return "badge-waiting";
    case "Pending":
      return "badge-pending";
    case "Active":
      return "badge-active";
    case "Ready for Delivery":
      return "badge-ready-delivery";
    case "Done":
      return "badge-done";
    case "Cancelled":
      return "badge-cancelled";
    default:
      return "badge-pending";
  }
}

function isCancellable(status: string): boolean {
  return CANCELLABLE_STATUSES.includes(status || "Preparing");
}

function statusHint(status: string): string {
  const s = status || "Preparing";
  if (s === "Cancelled") return "This order has been cancelled.";
  if (s === "Done") return "This order is complete.";
  return "We are working on your order. Keep your order number handy.";
}

function computeTimeline(
  status: string
): { title: string; sub: string; state: DotState }[] {
  const s = status || "Preparing";
  if (s === "Cancelled") {
    return TIMELINE_STEPS.map((st) => ({ ...st, state: "cancelled" as DotState }));
  }
  const preparingActive = [
    "Preparing",
    "Pending",
    "Waiting on Payment",
    "Active",
    "Done",
  ].includes(s);
  const done = s === "Done";
  return TIMELINE_STEPS.map((st, i) => {
    let state: DotState = "inactive";
    if (i === 0) state = "active";
    else if (i === 1) state = preparingActive ? "active" : "inactive";
    else if (i === 2) state = done ? "active" : "inactive";
    else if (i === 3) state = done ? "active" : "inactive";
    return { ...st, state };
  });
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function fmtPrice(n: number): string {
  return `${n.toLocaleString()} ${CURRENCY}`;
}

function copyDetails(r: SuccessData): void {
  const text =
    `The Hudson Distillery\n` +
    `Order #${r.id}\n` +
    `Status: ${r.status}\n` +
    `Customer: ${r.customer}\n` +
    `Cancellation code: ${r.cancelCode}\n` +
    `Items: ${r.lines.map((l) => `${l.name} x${l.qty}`).join(", ")}\n` +
    `Total: ${r.total.toLocaleString()} ${CURRENCY}`;
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(
      () => toast("Order details copied for Discord.", "ok"),
      () => toast("Copy failed. Please copy manually.", "err")
    );
  } else {
    toast("Clipboard is not available in this browser.", "err");
  }
}

function printReceipt(r: SuccessData): void {
  const itemRows = r.lines
    .map(
      (l) =>
        `<div class="receipt-row"><span>${escapeHtml(l.name)} ×${l.qty}</span><span>${fmtPrice(
          l.qty * l.price
        )}</span></div>`
    )
    .join("");
  const html =
    `<!DOCTYPE html><html><head><meta charset="utf-8"/>` +
    `<title>Receipt #${r.id}</title>` +
    `<style>` +
    `body{margin:0;padding:24px;background:#fff;font-family:Arial,sans-serif}` +
    `.receipt-card{border:1px solid #000;padding:24px;max-width:720px;margin:0 auto;background:#fff;color:#000;font-family:Arial,sans-serif}` +
    `.receipt-header{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px;padding-bottom:12px;border-bottom:1px solid #ddd}` +
    `.receipt-logo{height:54px;width:54px;object-fit:contain;border-radius:6px}` +
    `.receipt-title{font-size:24px;font-weight:700;margin-bottom:2px}` +
    `.receipt-sub{font-size:13px;color:#444;margin-bottom:0}` +
    `.receipt-row{display:flex;justify-content:space-between;gap:12px;padding:6px 0;border-bottom:1px solid #ddd;font-size:13px}` +
    `.receipt-row:last-child{border-bottom:none}` +
    `.receipt-total{font-size:16px;font-weight:700;padding-top:10px;margin-top:6px;border-top:2px solid #000;display:flex;justify-content:space-between}` +
    `.receipt-note{margin-top:16px;font-size:12px;color:#444;line-height:1.6}` +
    `@media print{body{padding:0}}` +
    `</style></head><body>` +
    `<div class="receipt-card">` +
    `<div class="receipt-header">` +
    `<div><div class="receipt-title">THE HUDSON DISTILLERY</div>` +
    `<div class="receipt-sub">Order receipt • ${escapeHtml(r.date)}</div></div>` +
    `<img class="receipt-logo" src="${LOGO_URL}" alt="The Hudson Distillery logo"/></div>` +
    `<div class="receipt-row"><span>Order number</span><span>#${r.id}</span></div>` +
    `<div class="receipt-row"><span>Customer</span><span>${escapeHtml(r.customer)}</span></div>` +
    `<div class="receipt-row"><span>Status</span><span>${escapeHtml(r.status)}</span></div>` +
    `<div class="receipt-row"><span>Cancellation code</span><span>${escapeHtml(r.cancelCode)}</span></div>` +
    itemRows +
    `<div class="receipt-total"><span>Total</span><span>${fmtPrice(r.total)}</span></div>` +
    `<div class="receipt-note">Thanks for ordering with us. Keep this receipt or share it in Discord if you need help with your order.</div>` +
    `</div>` +
    `<script>window.onload=function(){window.print();}<\/script>` +
    `</body></html>`;
  const w = window.open("", "_blank", "width=760,height=900");
  if (!w) {
    toast("Pop-up blocked. Please allow pop-ups to print the receipt.", "err");
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}

/* ── Sub-components ────────────────────────────────────────────────── */

function TosBlock({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <div className="tos-wrap">
      <button
        type="button"
        className="tos-toggle"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span>Terms of Service</span>
        <span>View</span>
      </button>
      <div className={"tos-body" + (open ? " open" : "")}>
        <p>By placing an order, you agree to the following:</p>
        <ul>
          {TOS_BULLETS.map((b) => (
            <li key={b}>{b}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function MenuCard({
  item,
  qty,
  selected,
  onToggle,
  onChangeQty,
  onSetQty,
}: {
  item: InventoryItem;
  qty: number;
  selected: boolean;
  onToggle: () => void;
  onChangeQty: (delta: number) => void;
  onSetQty: (val: number) => void;
}) {
  return (
    <div
      className={"menu-card" + (selected ? " selected" : "")}
      onClick={onToggle}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onToggle();
        }
      }}
      aria-pressed={selected}
    >
      <div className="menu-name">{item.name}</div>
      <div className="menu-price">{fmtPrice(item.price)}</div>
      <div className="menu-qty" onClick={(e) => e.stopPropagation()}>
        <button
          type="button"
          className="qty-btn"
          onClick={() => onChangeQty(-1)}
          aria-label={`Decrease ${item.name} quantity`}
        >
          −
        </button>
        <input
          className="qty-input"
          type="number"
          min={1}
          value={qty}
          onChange={(e) => onSetQty(parseInt(e.target.value, 10))}
          aria-label={`${item.name} quantity`}
        />
        <button
          type="button"
          className="qty-btn"
          onClick={() => onChangeQty(1)}
          aria-label={`Increase ${item.name} quantity`}
        >
          +
        </button>
      </div>
    </div>
  );
}

function SummaryCard({
  lines,
  total,
}: {
  lines: OrderLine[];
  total: number;
}) {
  return (
    <div className="summary-card">
      <div className="card-title">Your order</div>
      {lines.length === 0 ? (
        <div className="empty-cart">NO ITEMS SELECTED YET</div>
      ) : (
        <>
          {lines.map((l) => (
            <div className="summary-line" key={l.itemId}>
              <span style={{ color: "var(--text0)" }}>
                {l.name} <span style={{ color: "var(--text2)" }}>×{l.qty}</span>
              </span>
              <span
                style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}
              >
                {fmtPrice(l.qty * l.price)}
              </span>
            </div>
          ))}
          <div className="summary-total">
            <span>Total</span>
            <span>{fmtPrice(total)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function SuccessBox({
  data,
  onReset,
}: {
  data: SuccessData;
  onReset: () => void;
}) {
  return (
    <div className="success-box">
      <div className="success-icon">🥃</div>
      <div className="success-title">Order placed!</div>
      <div className="success-sub">Your order number is:</div>
      <div className="success-id">{`#${data.id}`}</div>
      <div className="success-sub">Your cancellation code is:</div>
      <div className="success-id" style={{ marginTop: 8 }}>
        {data.cancelCode}
      </div>
      <div className="success-card">
        <div className="success-card-title">What happens next</div>
        <div className="success-grid">
          <div className="success-detail">
            <div className="success-label">Status</div>
            <div className="success-value">{data.status}</div>
          </div>
          <div className="success-detail">
            <div className="success-label">Follow-up</div>
            <div className="success-value">
              Use your order number and code to track it
            </div>
          </div>
        </div>
        <div className="success-note">
          This summary is easy to paste into Discord, save, or print for pickup.
        </div>
      </div>
      <div className="success-actions">
        <button
          type="button"
          className="reset-btn"
          onClick={() => copyDetails(data)}
        >
          📋 Copy details
        </button>
        <button
          type="button"
          className="reset-btn"
          onClick={() => printReceipt(data)}
        >
          🖨 Print receipt
        </button>
        <button type="button" className="reset-btn" onClick={onReset}>
          🛒 Place another order
        </button>
      </div>
    </div>
  );
}

function TrackResultView({
  result,
  loadingCancel,
  onCancel,
}: {
  result: TrackResult;
  loadingCancel: boolean;
  onCancel: (id: number | string) => void;
}) {
  if (result.kind === "empty") {
    return (
      <div style={{ padding: "12px 0", color: "var(--red)" }}>
        Please enter an order number.
      </div>
    );
  }
  if (result.kind === "notfound") {
    return (
      <div style={{ padding: "12px 0", color: "var(--red)" }}>
        {`Order #${result.id} was not found.`}
      </div>
    );
  }
  const order = result.order;
  const status = order.status || "Preparing";
  const canCancel = isCancellable(status);
  const lines = order.lines || [];
  return (
    <div
      style={{
        border: "1px solid var(--border)",
        borderRadius: 6,
        padding: 16,
        background: "rgba(255,255,255,.02)",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <div>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text2)",
              letterSpacing: 1,
            }}
          >
            ORDER
          </div>
          <div
            style={{
              fontFamily: "var(--font-head)",
              fontSize: 20,
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            {`#${order.id}`}
          </div>
        </div>
        <span className={`badge ${statusBadgeClass(status)}`}>{status}</span>
      </div>
      <div style={{ fontSize: 13, color: "var(--text1)", marginBottom: 10 }}>
        Customer:{" "}
        <strong style={{ color: "var(--text0)" }}>{order.customer || "—"}</strong>
      </div>
      <div style={{ fontSize: 13, color: "var(--text1)", marginBottom: 10 }}>
        {statusHint(status)}
      </div>
      <div style={{ marginBottom: 10 }}>
        {lines.length === 0 ? (
          <div className="empty-cart">No items listed</div>
        ) : (
          lines.map((l) => (
            <div
              className="summary-line"
              style={{ padding: "4px 0" }}
              key={l.itemId}
            >
              <span style={{ color: "var(--text0)" }}>
                {l.name}{" "}
                <span style={{ color: "var(--text2)" }}>×{l.qty}</span>
              </span>
              <span
                style={{ fontFamily: "var(--font-mono)", color: "var(--accent)" }}
              >
                {fmtPrice(l.qty * l.price)}
              </span>
            </div>
          ))
        )}
      </div>
      <div style={{ marginTop: 12 }}>
        <div
          style={{
            fontFamily: "var(--font-mono)",
            fontSize: 10,
            letterSpacing: 1,
            color: "var(--text2)",
            textTransform: "uppercase",
            marginBottom: 6,
          }}
        >
          Status timeline
        </div>
        <div className="status-timeline">
          {computeTimeline(status).map((step) => (
            <div className={`status-step ${step.state}`} key={step.title}>
              <div className="status-dot" />
              <div>
                <div className="status-step-title">{step.title}</div>
                <div className="status-step-sub">{step.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {canCancel ? (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            marginTop: 8,
          }}
        >
          <button
            type="button"
            className="reset-btn"
            style={{ marginTop: 0 }}
            onClick={() => onCancel(order.id)}
            disabled={loadingCancel}
          >
            {loadingCancel ? "Cancelling…" : "Cancel order"}
          </button>
          <div style={{ fontSize: 12, color: "var(--text2)" }}>
            Enter the code above, then press the button to cancel.
          </div>
        </div>
      ) : (
        <div style={{ fontSize: 12, color: "var(--text2)" }}>
          This order can no longer be cancelled.
        </div>
      )}
    </div>
  );
}

function DiscordLink({ href }: { href: string }) {
  if (!href) return null;
  const display = href.replace(/^https?:\/\//, "");
  return (
    <div
      style={{
        marginTop: 16,
        padding: 16,
        border: "1px solid rgba(200,168,75,.2)",
        borderRadius: 4,
        background: "rgba(200,168,75,.05)",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: 10,
          color: "var(--text2)",
          letterSpacing: 1,
          marginBottom: 8,
        }}
      >
        JOIN OUR DISCORD
      </div>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          fontFamily: "var(--font-head)",
          fontSize: 16,
          fontWeight: 600,
          color: "var(--accent)",
          textDecoration: "none",
          letterSpacing: 1,
        }}
      >
        {`🎮 ${display}`}
      </a>
    </div>
  );
}

/* ── Main component ────────────────────────────────────────────────── */

export default function OrderView() {
  const [siteStatus, setSiteStatus] = useState<SiteStatus>({
    closed: false,
    message: "Orders are temporarily paused. Please check back soon.",
    discordLink: "",
  });
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [formName, setFormName] = useState("");
  const [formDiscord, setFormDiscord] = useState("");
  const [formSteam, setFormSteam] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [agreeTos, setAgreeTos] = useState(false);
  const [success, setSuccess] = useState<SuccessData | null>(null);
  const [trackInput, setTrackInput] = useState("");
  const [cancelCodeInput, setCancelCodeInput] = useState("");
  const [trackResult, setTrackResult] = useState<TrackResult | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [loadingInventory, setLoadingInventory] = useState(true);
  const [loadingTrack, setLoadingTrack] = useState(false);
  const [loadingCancel, setLoadingCancel] = useState(false);
  const [tosOpen, setTosOpen] = useState(false);
  const [closedTosOpen, setClosedTosOpen] = useState(false);
  const companyRef = useRef<HTMLInputElement>(null);

  // Initial load: site status + inventory in parallel.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [statusRes, invRes] = await Promise.allSettled([
        api<SiteStatus>("/api/public/status"),
        api<{ items: InventoryItem[] }>("/api/public/inventory"),
      ]);
      if (cancelled) return;
      if (statusRes.status === "fulfilled") {
        const s = statusRes.value;
        setSiteStatus({
          closed: !!s.closed,
          message:
            s.message || "Orders are temporarily paused. Please check back soon.",
          discordLink: s.discordLink || "",
        });
      } else {
        toast("Could not load site status.", "err");
      }
      if (invRes.status === "fulfilled") {
        setItems(invRes.value.items || []);
      } else {
        toast("Could not load menu.", "err");
      }
      setLoadingStatus(false);
      setLoadingInventory(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function getTotal(): number {
    let t = 0;
    for (const key of Object.keys(cart)) {
      const item = items.find((i) => String(i.id) === key);
      if (item) t += item.price * cart[key];
    }
    return t;
  }

  function getItemCount(): number {
    return Object.values(cart).reduce((s, q) => s + (q || 0), 0);
  }

  function toggleItem(id: number | string): void {
    setCart((prev) => {
      const next = { ...prev };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  }

  function changeQty(id: number | string, delta: number): void {
    setCart((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      next[id] = Math.max(1, (prev[id] || 1) + delta);
      return next;
    });
  }

  function setQty(id: number | string, val: number): void {
    setCart((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      next[id] = Math.max(1, Number.isNaN(val) ? 1 : val);
      return next;
    });
  }

  function resetForm(): void {
    setCart({});
    setFormName("");
    setFormDiscord("");
    setFormSteam("");
    setFormNotes("");
    setAgreeTos(false);
    setSuccess(null);
    if (companyRef.current) companyRef.current.value = "";
  }

  async function handleSubmit(): Promise<void> {
    if (siteStatus.closed) {
      toast("Orders are currently closed. Please try again later.", "err");
      return;
    }
    const name = formName.trim();
    if (!name) {
      toast("Enter your name", "err");
      return;
    }
    const entries = Object.entries(cart).filter(([, q]) => q > 0);
    if (!entries.length) {
      toast("Select at least one item", "err");
      return;
    }
    if (!agreeTos) {
      toast("Please agree to the Terms of Service.", "err");
      return;
    }
    const total = getTotal();
    const itemCount = getItemCount();
    if (total > MAX_ORDER_TOTAL) {
      toast(
        `That order exceeds the maximum allowed total of ${MAX_ORDER_TOTAL.toLocaleString()} ${CURRENCY}.`,
        "err"
      );
      return;
    }
    if (itemCount > MAX_ITEMS_PER_ORDER) {
      toast("That order exceeds the maximum allowed item count.", "err");
      return;
    }
    const itemsPayload = entries.map(([k, q]) => ({
      itemId: k,
      qty: q,
    }));
    const company = companyRef.current?.value || "";
    setSubmitting(true);
    try {
      const res = await api<{
        id: number;
        status: string;
        cancelCode: string;
        lines: OrderLine[];
        total: number;
        date: string;
        customer: string;
      }>("/api/public/order", {
        method: "POST",
        body: {
          customer: name,
          contact: formDiscord.trim(),
          steam: formSteam.trim(),
          notes: formNotes.trim(),
          items: itemsPayload,
          company,
        },
      });
      if (!res || !res.id) {
        toast("Failed to place order.", "err");
        return;
      }
      setSuccess({
        id: res.id,
        cancelCode: res.cancelCode,
        status: res.status || "Preparing",
        customer: res.customer,
        lines: res.lines || [],
        total: res.total,
        date: res.date,
      });
      toast(`Order #${res.id} placed.`, "ok");
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Failed to place order.";
      toast(msg, "err");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTrack(idOverride?: number | string): Promise<void> {
    const id = idOverride ?? trackInput.trim();
    if (!id) {
      setTrackResult({ kind: "empty" });
      return;
    }
    setLoadingTrack(true);
    try {
      const res = await api<{ order: PublicOrder }>(
        `/api/public/order/track?id=${encodeURIComponent(String(id))}`
      );
      setTrackResult({ kind: "order", order: res.order });
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        setTrackResult({ kind: "notfound", id });
      } else {
        const msg = e instanceof ApiError ? e.message : "Failed to track order.";
        toast(msg, "err");
        setTrackResult(null);
      }
    } finally {
      setLoadingTrack(false);
    }
  }

  async function handleCancel(id: number | string): Promise<void> {
    const code = cancelCodeInput.trim().toUpperCase();
    if (!code) {
      toast(
        "Enter the cancellation code from your order confirmation, then press the button.",
        "err"
      );
      return;
    }
    setLoadingCancel(true);
    try {
      await api<{ ok: true; id: number; date: string }>(
        "/api/public/order/cancel",
        {
          method: "POST",
          body: { id, code },
        }
      );
      toast(`Order #${id} cancelled.`, "ok");
      await handleTrack(id);
    } catch (e) {
      const msg = e instanceof ApiError ? e.message : "Could not cancel this order.";
      toast(msg, "err");
    } finally {
      setLoadingCancel(false);
    }
  }

  const closed = siteStatus.closed;
  const summaryLines: OrderLine[] = Object.entries(cart)
    .filter(([, q]) => q > 0)
    .map(([k, q]) => {
      const item = items.find((i) => String(i.id) === k);
      return {
        itemId: k,
        name: item ? item.name : "—",
        qty: q,
        price: item ? item.price : 0,
      };
    });
  const total = getTotal();

  return (
    <div
      className="hd-order-bg"
      style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
    >
      <header className="site-header">
        <img
          src={LOGO_URL}
          alt="The Hudson Distillery logo"
          style={{ height: 56, width: 56, objectFit: "contain" }}
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
        <div className="site-logo-text">
          THE HUDSON <span>DISTILLERY</span>
        </div>
      </header>

      <div className="container" style={{ flex: 1 }}>
        {loadingStatus ? (
          <div
            style={{
              textAlign: "center",
              padding: 48,
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              color: "var(--text2)",
            }}
          >
            LOADING…
          </div>
        ) : closed ? (
          <>
            <div
              style={{
                marginBottom: 20,
                padding: "18px 20px",
                border: "1px solid rgba(224,92,92,.35)",
                borderRadius: 6,
                background: "rgba(224,92,92,.1)",
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-head)",
                  fontSize: 20,
                  fontWeight: 700,
                  color: "var(--red)",
                  marginBottom: 6,
                }}
              >
                🛑 Orders temporarily paused
              </div>
              <div
                style={{ fontSize: 14, color: "var(--text1)", lineHeight: 1.6 }}
              >
                {siteStatus.message}
              </div>
            </div>
            <div style={{ marginTop: 8, marginBottom: 24 }}>
              <TosBlock
                open={closedTosOpen}
                onToggle={() => setClosedTosOpen((v) => !v)}
              />
            </div>
          </>
        ) : success ? (
          <SuccessBox data={success} onReset={resetForm} />
        ) : (
          <>
            <div className="page-title">Place your order</div>
            <div className="page-sub">
              {"SELECT YOUR DRINKS BELOW — WE'LL HANDLE THE REST"}
            </div>

            <div className="menu-grid">
              {loadingInventory && items.length === 0 ? (
                <div
                  style={{
                    gridColumn: "1/-1",
                    textAlign: "center",
                    padding: 32,
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--text2)",
                  }}
                >
                  LOADING MENU...
                </div>
              ) : items.length === 0 ? (
                <div
                  style={{
                    gridColumn: "1/-1",
                    textAlign: "center",
                    padding: 32,
                    fontFamily: "var(--font-mono)",
                    fontSize: 12,
                    color: "var(--text2)",
                  }}
                >
                  NO ITEMS AVAILABLE
                </div>
              ) : (
                items.map((item) => (
                  <MenuCard
                    key={item.id}
                    item={item}
                    qty={cart[item.id] || 1}
                    selected={!!cart[item.id]}
                    onToggle={() => toggleItem(item.id)}
                    onChangeQty={(d) => changeQty(item.id, d)}
                    onSetQty={(v) => setQty(item.id, v)}
                  />
                ))
              )}
            </div>

            <SummaryCard lines={summaryLines} total={total} />

            <div className="form-section">
              <div className="card-title" style={{ marginBottom: 16 }}>
                Your details
              </div>
              <div className="form-grid-2">
                <div className="form-group">
                  <label htmlFor="f-name">Your name / IGN *</label>
                  <input
                    id="f-name"
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. WarriorXX99"
                    autoComplete="name"
                  />
                </div>
                <div className="form-group">
                  <label htmlFor="f-discord">Discord (optional)</label>
                  <input
                    id="f-discord"
                    type="text"
                    value={formDiscord}
                    onChange={(e) => setFormDiscord(e.target.value)}
                    placeholder="e.g. warrior#1234"
                    autoComplete="off"
                  />
                </div>
              </div>
              <div className="form-group">
                <label htmlFor="f-steam">Steam ID 64 (optional)</label>
                <input
                  id="f-steam"
                  type="text"
                  value={formSteam}
                  onChange={(e) => setFormSteam(e.target.value)}
                  placeholder="e.g. 76561199401090066"
                  autoComplete="off"
                />
              </div>
              <div className="form-group">
                <label htmlFor="f-notes">Notes (optional)</label>
                <textarea
                  id="f-notes"
                  value={formNotes}
                  onChange={(e) => setFormNotes(e.target.value)}
                  placeholder="Delivery location, special requests..."
                />
              </div>
              {/* Honeypot — visually hidden. Real users never fill it; server no-ops if filled. */}
              <input
                ref={companyRef}
                type="text"
                name="company"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                style={{
                  position: "absolute",
                  left: "-9999px",
                  width: "1px",
                  height: "1px",
                  opacity: 0,
                }}
              />
            </div>

            <button
              type="button"
              className="submit-btn"
              onClick={handleSubmit}
              disabled={submitting}
            >
              {submitting ? "Placing order…" : "Place order"}
            </button>

            <div className="checkbox-row">
              <input
                id="agree-tos"
                type="checkbox"
                checked={agreeTos}
                onChange={(e) => setAgreeTos(e.target.checked)}
              />
              <label htmlFor="agree-tos">
                I agree to the Terms of Service and understand that I am
                submitting my details for order processing.
              </label>
            </div>

            <TosBlock open={tosOpen} onToggle={() => setTosOpen((v) => !v)} />
          </>
        )}

        {/* Track / cancel — always visible below the order stage. */}
        <div className="form-section" style={{ marginTop: 24 }}>
          <div className="card-title" style={{ marginBottom: 16 }}>
            Track or cancel your order
          </div>
          <div className="form-group">
            <label htmlFor="public-track-input">Order number</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input
                id="public-track-input"
                type="number"
                min={1}
                value={trackInput}
                onChange={(e) => setTrackInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleTrack();
                }}
                placeholder="e.g. 1002"
                style={{ maxWidth: 220 }}
                aria-label="Order number"
              />
              <button
                type="button"
                className="submit-btn"
                onClick={() => handleTrack()}
                disabled={loadingTrack}
                style={{
                  width: "auto",
                  padding: "10px 16px",
                  minWidth: 140,
                }}
              >
                {loadingTrack ? "Tracking…" : "Track order"}
              </button>
            </div>
          </div>
          <div className="form-group" style={{ marginTop: 8 }}>
            <label htmlFor="public-cancel-code">
              Cancellation code (only for cancelling)
            </label>
            <input
              id="public-cancel-code"
              type="text"
              value={cancelCodeInput}
              onChange={(e) => setCancelCodeInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleTrack();
              }}
              placeholder="e.g. A1B2C3"
              style={{ maxWidth: 220, textTransform: "uppercase" }}
              aria-label="Cancellation code"
            />
          </div>
          <div style={{ marginTop: 8 }}>
            {trackResult && (
              <TrackResultView
                result={trackResult}
                loadingCancel={loadingCancel}
                onCancel={handleCancel}
              />
            )}
          </div>
        </div>

        <DiscordLink href={siteStatus.discordLink} />
      </div>

      <footer
        style={{
          marginTop: "auto",
          borderTop: "1px solid var(--border)",
          background: "var(--bg1)",
          padding: "12px 24px",
          textAlign: "center",
          fontFamily: "var(--font-mono)",
          fontSize: 11,
          color: "var(--text2)",
          letterSpacing: 1,
        }}
      >
        The Hudson Distillery — not affiliated with Unturned™ or URP.
      </footer>
    </div>
  );
}
