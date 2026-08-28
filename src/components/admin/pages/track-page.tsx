"use client";
// Track order page: staff/customer order lookup + status timeline + lines.
// Looks the order up from the data the admin already has loaded
// (admins see cancel codes + full rows). The public /track endpoint now
// requires the customer's cancel code, so staff use local data instead —
// faster and no extra round-trip.
import { CURRENCY, type PublicOrder } from "@/lib/types";
import { FOCUS_RING, TOUCH_TARGET } from "../components/touch";

export function TrackPage({
  input,
  setInput,
  result,
  loading,
  onTrack,
}: {
  input: string;
  setInput: (s: string) => void;
  result: PublicOrder | null | "not-found";
  loading: boolean;
  onTrack: () => void;
}) {
  return (
    <div>
      <div className="section-head">
        <div className="section-title">Track your order</div>
      </div>
      <div style={{ maxWidth: 480, margin: "0 auto" }}>
        <div className="card" style={{ padding: 24 }}>
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label htmlFor="hd-track-input">Order number</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="hd-track-input"
                type="number"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="e.g. 1002"
                onKeyDown={(e) => {
                  if (e.key === "Enter") onTrack();
                }}
              />
              <button
                className={`btn btn-accent ${TOUCH_TARGET} ${FOCUS_RING}`}
                onClick={onTrack}
                disabled={loading}
              >
                {loading ? "🔍 Tracking…" : "🔍 Track"}
              </button>
            </div>
          </div>
          <div id="track-result">
            {result === null ? null : result === "not-found" ? (
              <div
                style={{
                  textAlign: "center",
                  padding: 24,
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--red)",
                }}
              >
                ❌ Order #{input || "?"} not found.
              </div>
            ) : (
              <TrackResult order={result} />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TrackResult({ order }: { order: PublicOrder }) {
  const steps = [
    {
      key: "Preparing",
      label: "Preparing",
      icon: "⚙️",
      desc: "Your order is being prepared",
    },
    {
      key: "Waiting on Payment",
      label: "Ready for pickup",
      icon: "📦",
      desc: "Your order is ready to be collected or delivered",
    },
    {
      key: "Done",
      label: "Completed",
      icon: "✅",
      desc: "Your order is complete",
    },
  ];
  const isCancelled = order.status === "Cancelled";
  const statusIndex = steps.findIndex(
    (s) =>
      s.key === order.status ||
      (order.status === "Pending" && s.key === "Preparing") ||
      (order.status === "Active" && s.key === "Waiting on Payment")
  );

  return (
    <div
      style={{
        borderTop: "1px solid var(--border)",
        paddingTop: 20,
        marginTop: 4,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 16,
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
              fontSize: 22,
              fontWeight: 700,
              color: "var(--accent)",
            }}
          >
            #{order.id}
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              color: "var(--text2)",
              letterSpacing: 1,
            }}
          >
            CUSTOMER
          </div>
          <div style={{ fontWeight: 600, color: "var(--text0)" }}>
            {order.customer}
          </div>
        </div>
      </div>
      {isCancelled ? (
        <div
          style={{
            background: "rgba(224,92,92,.1)",
            border: "1px solid rgba(224,92,92,.3)",
            borderRadius: 4,
            padding: 16,
            textAlign: "center",
            marginBottom: 16,
          }}
        >
          <div style={{ fontSize: 24, marginBottom: 6 }}>❌</div>
          <div
            style={{
              fontFamily: "var(--font-head)",
              fontSize: 18,
              color: "var(--red)",
            }}
          >
            Order Cancelled
          </div>
        </div>
      ) : (
        steps.map((s, i) => {
          const done = !isCancelled && i < statusIndex;
          const current = !isCancelled && i === statusIndex;
          const color = done
            ? "var(--green)"
            : current
              ? "var(--accent)"
              : "var(--border2)";
          const textColor = done
            ? "var(--green)"
            : current
              ? "var(--accent)"
              : "var(--text2)";
          return (
            <div
              key={s.key}
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: "50%",
                  border: `2px solid ${color}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 15,
                  flexShrink: 0,
                }}
              >
                {done ? "✓" : s.icon}
              </div>
              <div style={{ paddingTop: 4 }}>
                <div
                  style={{
                    fontFamily: "var(--font-head)",
                    fontSize: 15,
                    fontWeight: 600,
                    color: textColor,
                  }}
                >
                  {s.label}
                </div>
                <div style={{ fontSize: 12, color: "var(--text2)" }}>
                  {s.desc}
                </div>
              </div>
            </div>
          );
        })
      )}
      <div className="order-lines">
        {order.lines.map((l, idx) => (
          <div className="order-line" key={idx}>
            <span className="order-line-name">{l.name}</span>
            <span style={{ color: "var(--text2)", fontSize: 12 }}>
              ×{l.qty}
            </span>
            <span className="order-line-price">
              {(l.qty * l.price).toLocaleString()} {CURRENCY}
            </span>
          </div>
        ))}
        <div
          className="order-line"
          style={{
            borderTop: "1px solid var(--border)",
            paddingTop: 8,
            marginTop: 4,
          }}
        >
          <span className="order-line-name" style={{ fontWeight: 600 }}>
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
            {order.total.toLocaleString()} {CURRENCY}
          </span>
        </div>
      </div>
    </div>
  );
}
