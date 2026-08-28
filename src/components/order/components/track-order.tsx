"use client";

// Track / cancel section — visible in every storefront state (open, closed,
// after success), exactly like the original page. Tracking now REQUIRES the
// 8-character cancellation code together with the order number; a wrong
// number or a wrong code returns the same generic "not found" result.
//
// Recent orders (from localStorage) appear as one-click chips above the form.

import { motion } from "framer-motion";
import { Clock, X } from "lucide-react";
import {
  computeTimeline,
  fmtPrice,
  isCancellable,
  statusBadgeClass,
  statusHint,
  type TrackResult,
} from "../order-types";
import type { RecentOrder } from "../hooks/use-recent-orders";
import type { TrackOrderController } from "../hooks/use-track-order";

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
        Order not found — check the order number and the cancellation code.
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
            The code above is used to verify the cancellation.
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

export function TrackOrder({
  recentOrders,
  onQuickTrack,
  onForgetOrder,
  ...controller
}: TrackOrderController & {
  recentOrders?: RecentOrder[];
  onQuickTrack?: (entry: RecentOrder) => void;
  onForgetOrder?: (id: string) => void;
}) {
  const {
    trackInput,
    setTrackInput,
    cancelCodeInput,
    setCancelCodeInput,
    trackResult,
    loadingTrack,
    loadingCancel,
    handleTrack,
    handleCancel,
  } = controller;
  const recent = recentOrders ?? [];
  return (
    <div className="form-section" style={{ marginTop: 24 }}>
      <div className="card-title" style={{ marginBottom: 16 }}>
        Track or cancel your order
      </div>
      {recent.length > 0 && (
        <div
          className="hd-recent-orders"
          style={{ marginBottom: 14 }}
          role="group"
          aria-label="Your recent orders"
        >
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              letterSpacing: 1,
              color: "var(--text2)",
              textTransform: "uppercase",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Clock size={11} aria-hidden="true" /> Your recent orders — click to
            track
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {recent.map((entry) => (
              <span key={entry.id} className="hd-recent-chip-wrap">
                <button
                  type="button"
                  className="hd-recent-chip"
                  onClick={() => onQuickTrack?.(entry)}
                  disabled={loadingTrack}
                  aria-label={`Track order ${entry.id} from ${entry.date || "recent"}`}
                >
                  <strong>#{entry.id}</strong>
                  <span className="hd-recent-chip-code">{entry.code}</span>
                  {entry.total > 0 && (
                    <span className="hd-recent-chip-total">
                      {fmtPrice(entry.total)}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  className="hd-recent-chip-x"
                  onClick={() => onForgetOrder?.(entry.id)}
                  aria-label={`Forget order ${entry.id} on this device`}
                  title="Forget this order on this device"
                >
                  <X size={11} aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
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
          Cancellation code (required — 8 characters)
        </label>
        <input
          id="public-cancel-code"
          type="text"
          value={cancelCodeInput}
          onChange={(e) => setCancelCodeInput(e.target.value.toUpperCase())}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleTrack();
          }}
          placeholder="e.g. 8PAZEJYZ"
          maxLength={16}
          style={{ maxWidth: 220, textTransform: "uppercase" }}
          aria-label="Cancellation code"
        />
      </div>
      <div style={{ marginTop: 8 }} role="region" aria-live="polite">
        {trackResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22 }}
          >
            <TrackResultView
              result={trackResult}
              loadingCancel={loadingCancel}
              onCancel={handleCancel}
            />
          </motion.div>
        )}
      </div>
    </div>
  );
}
