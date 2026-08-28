"use client";
// 14-day sales trend for the admin dashboard: gold bars = orders per day,
// green line = revenue per day (right axis). Purely derived from the orders
// already loaded by use-admin-data — no extra API call. Cancelled orders are
// excluded. All colors come from the hd-* CSS vars so it follows the theme.
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { TrendingUp } from "lucide-react";
import { CURRENCY, orderTotal } from "@/lib/types";
import type { AdminOrder } from "../admin-helpers";

const DAYS = 14;

interface Bucket {
  date: string;
  label: string;
  orders: number;
  revenue: number;
}

function buildSeries(orders: AdminOrder[]): Bucket[] {
  const buckets = new Map<string, Bucket>();
  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    buckets.set(key, {
      date: key,
      label: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      orders: 0,
      revenue: 0,
    });
  }
  for (const o of orders) {
    if (o.status === "Cancelled") continue;
    const b = buckets.get(String(o.date || "").slice(0, 10));
    if (!b) continue;
    b.orders += 1;
    b.revenue += o.total ?? orderTotal(o.parsedLines);
  }
  return [...buckets.values()];
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: { payload?: Bucket }[];
}) {
  const p = payload?.[0]?.payload as Bucket | undefined;
  if (!active || !p) return null;
  return (
    <div
      style={{
        background: "var(--bg2)",
        border: "1px solid var(--border2)",
        borderRadius: 6,
        padding: "8px 12px",
        color: "var(--text0)",
        fontSize: 12,
        boxShadow: "var(--shadow, 0 8px 24px rgba(0,0,0,.35))",
      }}
      role="status"
    >
      <div style={{ fontWeight: 700, marginBottom: 4, color: "var(--accent)" }}>
        {p.label}
      </div>
      <div>
        <span style={{ color: "var(--text1)" }}>Orders: </span>
        <strong>{p.orders}</strong>
      </div>
      <div>
        <span style={{ color: "var(--text1)" }}>Revenue: </span>
        <strong>
          {p.revenue.toLocaleString()} {CURRENCY}
        </strong>
      </div>
    </div>
  );
}

export function SalesChart({ orders }: { orders: AdminOrder[] }) {
  const data = buildSeries(orders);
  const totalOrders = data.reduce((s, d) => s + d.orders, 0);
  const totalRevenue = data.reduce((s, d) => s + d.revenue, 0);
  const hasActivity = totalOrders > 0;

  return (
    <div className="card" style={{ padding: "16px 18px 8px" }}>
      <div className="card-head" style={{ marginBottom: 4 }}>
        <div
          className="card-title"
          style={{ display: "flex", alignItems: "center", gap: 8 }}
        >
          <TrendingUp size={16} style={{ color: "var(--accent)" }} aria-hidden="true" />
          Sales trend
        </div>
        <span className="muted-hint">
          {hasActivity
            ? `${totalOrders} order${totalOrders === 1 ? "" : "s"} · ${totalRevenue.toLocaleString()} ${CURRENCY} in the last ${DAYS} days`
            : `No completed orders in the last ${DAYS} days`}
        </span>
      </div>

      <div style={{ position: "relative", height: 216 }}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 12, right: 8, bottom: 0, left: -18 }}
          >
            <defs>
              <linearGradient id="hdBarGold" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent2)" stopOpacity={0.95} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="3 3"
              vertical={false}
            />
            <XAxis
              dataKey="label"
              interval={3}
              tick={{ fill: "var(--text2)", fontSize: 11 }}
              axisLine={{ stroke: "var(--border)" }}
              tickLine={false}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: "var(--text2)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <YAxis
              yAxisId="revenue"
              orientation="right"
              allowDecimals={false}
              tick={{ fill: "var(--text2)", fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "var(--accent-soft)", opacity: 0.4 }}
            />
            <Bar
              dataKey="orders"
              name="Orders"
              fill="url(#hdBarGold)"
              radius={[3, 3, 0, 0]}
              maxBarSize={20}
            />
            <Line
              yAxisId="revenue"
              dataKey="revenue"
              name="Revenue"
              stroke="var(--green)"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: "var(--green)" }}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {!hasActivity ? (
          <div
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              pointerEvents: "none",
            }}
          >
            <span
              style={{
                background: "var(--bg2)",
                border: "1px solid var(--border2)",
                borderRadius: 4,
                color: "var(--text2)",
                fontSize: 12,
                padding: "6px 12px",
                opacity: 0.9,
              }}
            >
              The trend appears here as soon as orders come in
            </span>
          </div>
        ) : null}
      </div>

      <div
        style={{
          display: "flex",
          gap: 16,
          justifyContent: "flex-end",
          padding: "2px 2px 8px",
          fontSize: 11.5,
          color: "var(--text2)",
        }}
      >
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            aria-hidden="true"
            style={{
              width: 10,
              height: 10,
              borderRadius: 2,
              background: "var(--accent)",
              display: "inline-block",
            }}
          />
          Orders / day
        </span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <span
            aria-hidden="true"
            style={{
              width: 14,
              height: 2,
              borderRadius: 2,
              background: "var(--green)",
              display: "inline-block",
            }}
          />
          Revenue / day
        </span>
      </div>
    </div>
  );
}
